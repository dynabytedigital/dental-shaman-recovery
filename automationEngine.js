const shopifyClient = require('./shopifyClient');
const emailService = require('./emailService');
const db = require('./database');

class AutomationEngine {
  constructor() {
    this.intervalHandle = null;
    this.startupTimeout = null;
    this.sequenceIntervalHandle = null;
    this.isRunning = false;
    this.lastRunStats = null;
    this.startIndividualSequenceWatcher();
  }

  // Watcher for individual customer sequences that were explicitly started
  startIndividualSequenceWatcher() {
    if (this.sequenceIntervalHandle) {
      clearInterval(this.sequenceIntervalHandle);
    }
    this.sequenceIntervalHandle = setInterval(() => {
      this.processIndividualSequences().catch(err =>
        console.error('[Sequence Watcher] Error:', err.message)
      );
    }, 60 * 1000); // Check every 60 seconds for individual customer sequences
  }

  start() {
    this.stop();

    const settings = db.getSettings();
    if (!settings.automationEnabled) {
      return;
    }

    const intervalMins = settings.scanIntervalMinutes || 15;
    const intervalMs = Math.max(1, intervalMins) * 60 * 1000;

    console.log(`[Automation Engine] Started. Scanning every ${intervalMins} minutes.`);

    this.startupTimeout = setTimeout(() => {
      if (this.isRunning && db.getSettings().automationEnabled) {
        this.runScan().catch(err => console.error('[Automation Engine] Scan error:', err.message));
      }
    }, 10000);

    this.intervalHandle = setInterval(() => {
      if (this.isRunning && db.getSettings().automationEnabled) {
        this.runScan().catch(err => console.error('[Automation Engine] Scan error:', err.message));
      }
    }, intervalMs);

    this.isRunning = true;
  }

  stop() {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    console.log('[Automation Engine] Paused / Standby.');
  }

  getStatus() {
    const settings = db.getSettings();
    const sequences = db.getAllCustomerSequences();
    const activeIndividualCount = Object.values(sequences).filter(s => s && s.active).length;
    return {
      active: Boolean(settings.automationEnabled && this.isRunning),
      automationEnabled: Boolean(settings.automationEnabled),
      activeIndividualCount,
      scanIntervalMinutes: settings.scanIntervalMinutes,
      lastRun: this.lastRunStats
    };
  }

  /**
   * Starts the 5-stage sequence for a single customer immediately.
   * Sends Stage 1 right away (if not already sent) and schedules Stages 2-5 based on configured timing.
   */
  async startSequenceForCheckout(checkoutId) {
    const checkout = await shopifyClient.getCheckoutById(checkoutId);
    if (!checkout) {
      throw new Error('Checkout not found in Shopify.');
    }
    if (!checkout.email) {
      throw new Error('Customer does not have an email address.');
    }

    const settings = db.getSettings();
    const sortedStages = [...(settings.templatesConfig || [])]
      .filter(t => t.enabled)
      .sort((a, b) => a.id - b.id);

    // Find the first enabled stage that has not been sent yet to this checkout
    const nextStage = sortedStages.find(t => !db.hasSentTemplate(checkout.id, t.id));
    let immediateSendResult = null;

    if (nextStage) {
      const rendered = emailService.renderTemplate(nextStage.id, checkout);
      immediateSendResult = await emailService.sendEmail({
        to: checkout.email,
        subject: rendered.subject,
        html: rendered.html,
        checkoutId: checkout.id,
        templateId: nextStage.id,
        mode: 'sequence',
        customerName: checkout.fullName
      });
    }

    const seq = db.startCustomerSequence(checkout.id, checkout.email);

    return {
      sequence: seq,
      immediateStageSent: nextStage ? nextStage.id : null,
      immediateSendResult
    };
  }

  /**
   * Processes only customers who have an active individual sequence started
   */
  async processIndividualSequences() {
    const sequences = db.getAllCustomerSequences();
    const activeIds = Object.keys(sequences).filter(id => sequences[id]?.active);
    if (activeIds.length === 0) return;

    const settings = db.getSettings();
    const checkouts = await shopifyClient.getAbandonedCheckouts({ limit: 100 });
    const now = new Date();

    for (const checkoutId of activeIds) {
      const seq = sequences[checkoutId];
      const checkout = checkouts.find(c => String(c.id) === String(checkoutId));
      if (!checkout || checkout.isCompleted || !checkout.email || db.isSuppressed(checkout.email)) {
        continue;
      }

      const hoursSinceStart = Math.max(0, (now.getTime() - new Date(seq.startedAt).getTime()) / (1000 * 60 * 60));
      const sortedStages = [...(settings.templatesConfig || [])]
        .filter(t => t.enabled)
        .sort((a, b) => a.id - b.id);

      for (const stage of sortedStages) {
        if (db.hasSentTemplate(checkout.id, stage.id)) {
          continue;
        }
        // Check if elapsed time since sequence start has reached this stage's configured minAgeHours
        if (hoursSinceStart >= Number(stage.minAgeHours || 0)) {
          try {
            const rendered = emailService.renderTemplate(stage.id, checkout);
            await emailService.sendEmail({
              to: checkout.email,
              subject: rendered.subject,
              html: rendered.html,
              checkoutId: checkout.id,
              templateId: stage.id,
              mode: 'sequence',
              customerName: checkout.fullName
            });
            break; // Only send one stage per scan tick per customer
          } catch (err) {
            console.error(`[Sequence Watcher] Failed stage ${stage.id} for ${checkout.email}:`, err.message);
          }
        }
      }
    }
  }

  async runScan() {
    const settings = db.getSettings();
    if (!settings.automationEnabled) {
      this.lastRunStats = {
        timestamp: new Date().toISOString(),
        status: 'skipped',
        reason: 'Global automation is paused'
      };
      return this.lastRunStats;
    }

    console.log('[Automation Engine] Running global abandoned checkout scan...');
    const startTime = Date.now();
    let scannedCount = 0;
    let sentCount = 0;
    let skippedCount = 0;
    const actions = [];

    try {
      const checkouts = await shopifyClient.getAbandonedCheckouts({ limit: 100 });
      scannedCount = checkouts.length;

      const now = new Date();
      const minCooldownHours = settings.minCooldownHours || 18;

      for (const checkout of checkouts) {
        if (checkout.isCompleted) {
          continue;
        }

        if (!checkout.email || db.isSuppressed(checkout.email)) {
          skippedCount++;
          continue;
        }

        const lastSent = db.getLastSentForCheckout(checkout.id);
        if (lastSent && lastSent.sentAt) {
          const hoursSinceLastSend = (now.getTime() - new Date(lastSent.sentAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastSend < minCooldownHours) {
            continue;
          }
        }

        const ageHours = checkout.ageHours;
        const matchingTemplate = settings.templatesConfig.find(t => {
          return t.enabled && ageHours >= t.minAgeHours && ageHours < t.maxAgeHours;
        });

        if (!matchingTemplate) {
          continue;
        }

        if (db.hasSentTemplate(checkout.id, matchingTemplate.id)) {
          continue;
        }

        try {
          console.log(`[Automation Engine] Sending Template ${matchingTemplate.id} to ${checkout.email}`);
          const rendered = emailService.renderTemplate(matchingTemplate.id, checkout);

          await emailService.sendEmail({
            to: checkout.email,
            subject: rendered.subject,
            html: rendered.html,
            checkoutId: checkout.id,
            templateId: matchingTemplate.id,
            mode: 'auto',
            customerName: checkout.fullName
          });

          sentCount++;
          actions.push({
            checkoutId: checkout.id,
            email: checkout.email,
            templateId: matchingTemplate.id,
            templateName: matchingTemplate.name,
            status: 'sent'
          });
        } catch (sendErr) {
          console.error(`[Automation Engine] Failed to send auto email to ${checkout.email}:`, sendErr.message);
          actions.push({
            checkoutId: checkout.id,
            email: checkout.email,
            templateId: matchingTemplate.id,
            status: 'failed',
            error: sendErr.message
          });
        }
      }

      this.lastRunStats = {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: 'completed',
        scannedCount,
        sentCount,
        skippedCount,
        actions
      };

      console.log(`[Automation Engine] Scan completed. Scanned: ${scannedCount}, Sent: ${sentCount}`);
      return this.lastRunStats;
    } catch (err) {
      console.error('[Automation Engine] Fatal error during scan:', err);
      this.lastRunStats = {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err.message
      };
      return this.lastRunStats;
    }
  }
}

module.exports = new AutomationEngine();
