require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const shopifyClient = require('./shopifyClient');
const emailService = require('./emailService');
const automationEngine = require('./automationEngine');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security & iframe headers for Shopify Admin embedding
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://shop.thedentalshaman.com 'self';"
  );
  res.setHeader('Bypass-Tunnel-Reminder', 'true');
  next();
});

// Authentication Middleware
const requireAuth = (req, res, next) => {
  // Allow open access to auth endpoints and public static files
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  const user = db.validateSession(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication token required.' });
  }

  req.user = user;
  next();
};

// Protect all /api routes except /api/auth
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) {
    return next();
  }
  return requireAuth(req, res, next);
});

// Public Health & Keep-Alive Endpoint (for Render & Cron-Job.org 24/7 free uptime)
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'The Dental Shaman Abandoned Checkout Recovery',
    timestamp: new Date().toISOString()
  });
});

// Shopify OAuth / Install Callback Handlers (Redirects cleanly to the embedded dashboard)
const handleShopifyAuthCallback = (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  res.redirect('/' + (query ? `?${query}` : ''));
};
app.get('/auth/callback', handleShopifyAuthCallback);
app.get('/api/auth/callback', handleShopifyAuthCallback);
app.get('/auth', handleShopifyAuthCallback);

// Serve index.html with dynamic SHOPIFY_CLIENT_ID injection so any new Shopify App slot works immediately
const serveIndexHtml = (req, res) => {
  try {
    const clientId = process.env.SHOPIFY_CLIENT_ID || 'dbdab26b574956c5bcee43ff417899d8';
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
    html = html.replace(/content="(65863b05cb87569d1f1fe3cdfe064fdb|dbdab26b574956c5bcee43ff417899d8)"/g, `content="${clientId}"`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
};
app.get('/', serveIndexHtml);
app.get('/index.html', serveIndexHtml);

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

/* ========================================================
   AUTHENTICATION ROUTES
======================================================== */

// Quick Access with Master Access Code
app.post('/api/auth/access', (req, res) => {
  try {
    const { accessKey, email } = req.body;
    const result = db.authenticateWithAccessKey(accessKey, email);
    console.log('[Auth] Access granted successfully.');
    res.json({ success: true, user: result.user, token: result.token });
  } catch (error) {
    console.warn('[Auth] Access denied: Invalid credentials.');
    res.status(401).json({ success: false, error: 'Invalid access key.' });
  }
});

// Register with Master Access Code
app.post('/api/auth/signup', (req, res) => {
  try {
    const { email, password, name, accessCode } = req.body;
    const result = db.createUser({ email, password, name, accessCode });
    res.json({ success: true, user: result.user, token: result.token });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Log In
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const result = db.authenticateUser({ email, password });
    res.json({ success: true, user: result.user, token: result.token });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

// Validate Current Session
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  const user = db.validateSession(token);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, user });
});

// Log Out
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (token) {
    db.deleteSession(token);
  }
  res.json({ success: true });
});

/* ========================================================
   PROTECTED APPLICATION ROUTES
======================================================== */

// 1. Dashboard Status & Overview Metrics
app.get('/api/status', async (req, res) => {
  try {
    const shopResult = await shopifyClient.testConnection();
    const automationStatus = automationEngine.getStatus();
    const logs = db.getLogs();
    
    let checkouts = [];
    try {
      checkouts = await shopifyClient.getAbandonedCheckouts({ limit: 100 });
    } catch (e) {
      console.warn('Could not pre-fetch checkouts for metrics:', e.message);
    }

    const uncompletedCheckouts = checkouts.filter(c => !c.isCompleted);
    const recoverableTotal = uncompletedCheckouts.reduce((sum, c) => sum + parseFloat(c.totalPrice || 0), 0);
    const sentCount = logs.filter(l => l.status === 'sent').length;
    const totalSendsCount = logs.length;

    res.json({
      connected: shopResult.success,
      shop: shopResult.shop || { name: 'The Dental Shaman', domain: 'shop.thedentalshaman.com' },
      automation: automationStatus,
      metrics: {
        totalCheckoutsCount: totalSendsCount,
        totalSendsCount: totalSendsCount,
        uncompletedCount: uncompletedCheckouts.length,
        recoverableTotalFormatted: '£' + recoverableTotal.toFixed(2),
        totalEmailsSent: sentCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Fetch Checkouts with Enriched History
app.get('/api/checkouts', async (req, res) => {
  try {
    const checkouts = await shopifyClient.getAbandonedCheckouts({ limit: 100 });
    const settings = db.getSettings();

    const enriched = checkouts.map(c => {
      const history = db.getAllSentForCheckout(c.id);
      const lastSent = history.length > 0 ? history[0] : null;
      const sequence = db.getCustomerSequence(c.id);

      const enabledStages = [...(settings.templatesConfig || [])]
        .filter(t => t.enabled)
        .sort((a, b) => a.id - b.id);
      const nextUnsentStage = enabledStages.find(t => !db.hasSentTemplate(c.id, t.id));

      return {
        ...c,
        sentCount: history.length,
        lastSentAt: lastSent ? lastSent.sentAt : null,
        lastTemplateSent: lastSent ? lastSent.templateName : null,
        recommendedTemplateId: nextUnsentStage ? nextUnsentStage.id : 1,
        sequence,
        history
      };
    });

    res.json({ checkouts: enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2b. Start Individual Sequence for a Single Customer
app.post('/api/checkouts/:id/start-sequence', async (req, res) => {
  try {
    const result = await automationEngine.startSequenceForCheckout(req.params.id);
    res.json({
      success: true,
      message: `Sequence started and Stage ${result.immediateStageSent || 1} dispatched immediately.`,
      ...result
    });
  } catch (error) {
    console.error('Start sequence error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2c. Stop / Pause Individual Sequence for a Single Customer
app.post('/api/checkouts/:id/stop-sequence', (req, res) => {
  try {
    const sequence = db.stopCustomerSequence(req.params.id);
    res.json({
      success: true,
      message: 'Customer sequence paused.',
      sequence
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2d. Update Cadence Sequence Timing for All 5 Stages
app.put('/api/cadence', (req, res) => {
  try {
    const { templatesConfig } = req.body;
    if (!Array.isArray(templatesConfig)) {
      return res.status(400).json({ success: false, error: 'Invalid templatesConfig payload.' });
    }
    const current = db.getSettings();
    const updatedConfig = (current.templatesConfig || []).map(stage => {
      const incoming = templatesConfig.find(t => Number(t.id) === Number(stage.id));
      if (!incoming) return stage;
      return {
        ...stage,
        minAgeHours: incoming.minAgeHours !== undefined ? Math.max(0, Number(incoming.minAgeHours)) : stage.minAgeHours,
        maxAgeHours: incoming.maxAgeHours !== undefined ? Math.max(1, Number(incoming.maxAgeHours)) : stage.maxAgeHours,
        enabled: incoming.enabled !== undefined ? Boolean(incoming.enabled) : stage.enabled,
        subject: incoming.subject !== undefined ? incoming.subject : stage.subject
      };
    });
    const updated = db.updateSettings({ templatesConfig: updatedConfig });
    res.json({ success: true, templatesConfig: updated.templatesConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Preview Email Template for a Checkout (Supports both GET & POST)
const handleCheckoutPreview = async (req, res) => {
  try {
    const templateId = req.query.templateId || req.body?.templateId || 1;
    const customSubject = req.query.customSubject || req.body?.customSubject || null;
    const checkout = await shopifyClient.getCheckoutById(req.params.id);

    if (!checkout) {
      return res.status(404).json({ error: 'Checkout not found' });
    }

    const rendered = emailService.renderTemplate(Number(templateId) || 1, checkout, customSubject);
    res.json({
      checkout,
      templateId: Number(templateId || 1),
      subject: rendered.subject,
      html: rendered.html
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/checkouts/:id/preview', handleCheckoutPreview);
app.post('/api/checkouts/:id/preview', handleCheckoutPreview);

// 4. Manually Send Email to a Specific Checkout
app.post('/api/checkouts/:id/send', async (req, res) => {
  try {
    const { templateId, customSubject, customHtml, recipientEmail } = req.body;
    const checkout = await shopifyClient.getCheckoutById(req.params.id);

    if (!checkout) {
      return res.status(404).json({ error: 'Checkout not found' });
    }

    const emailToSend = recipientEmail || checkout.email;
    if (!emailToSend) {
      return res.status(400).json({ error: 'No email address available for this checkout.' });
    }

    const rendered = emailService.renderTemplate(templateId || 1, checkout, customSubject);
    const finalHtml = customHtml || rendered.html;
    const finalSubject = customSubject || rendered.subject;

    const result = await emailService.sendEmail({
      to: emailToSend,
      subject: finalSubject,
      html: finalHtml,
      checkoutId: checkout.id,
      templateId: Number(templateId || 1),
      mode: 'manual',
      customerName: checkout.fullName
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get Settings
app.get('/api/settings', (req, res) => {
  const settings = db.getSettings();
  const safe = JSON.parse(JSON.stringify(settings));
  if (safe.smtp && safe.smtp.pass) {
    safe.smtp.hasPassword = true;
    safe.smtp.pass = '••••••••';
  } else {
    safe.smtp.hasPassword = false;
  }
  res.json({ settings: safe });
});

// 6. Update Settings
app.post('/api/settings', (req, res) => {
  try {
    const incoming = req.body;
    const current = db.getSettings();

    if (incoming.smtp) {
      if (incoming.smtp.pass === '••••••••' || !incoming.smtp.pass) {
        incoming.smtp.pass = current.smtp.pass;
      }
    }

    const updated = db.updateSettings(incoming);

    if (updated.automationEnabled && !automationEngine.isRunning) {
      automationEngine.start();
    } else if (!updated.automationEnabled && automationEngine.isRunning) {
      automationEngine.stop();
    }

    res.json({ success: true, settings: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Verify SMTP / Send Test Email
app.post('/api/settings/test-email', async (req, res) => {
  try {
    const { testEmail, templateId } = req.body;
    if (!testEmail || !testEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'Please provide a valid recipient email address.' });
    }
    const target = testEmail.trim();
    const tplId = Number(templateId) || 1;

    await emailService.verifyConnection();
    const result = await emailService.sendTestEmail(target, tplId);

    res.json({
      success: true,
      message: `Test email (Stage ${tplId}) successfully delivered to ${target}!`,
      result
    });
  } catch (error) {
    console.error('Test email failure:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send test email. Please verify SMTP credentials.'
    });
  }
});

// 8. Trigger Background Automation Scan Immediately
app.post('/api/automation/trigger', async (req, res) => {
  try {
    const result = await automationEngine.runScan();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Toggle Automation On/Off
app.post('/api/automation/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    const settings = db.updateSettings({ automationEnabled: Boolean(enabled) });
    if (settings.automationEnabled) {
      automationEngine.start();
    } else {
      automationEngine.stop();
    }
    res.json({ success: true, automationEnabled: settings.automationEnabled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Activity Logs API
app.get('/api/logs', (req, res) => {
  res.json({ logs: db.getLogs() });
});

// Delete specific log
app.delete('/api/logs/:id', (req, res) => {
  try {
    const success = db.deleteLog(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Log entry not found' });
    }
    res.json({ success: true, message: 'Log entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all logs
app.delete('/api/logs', (req, res) => {
  try {
    db.clearLogs();
    res.json({ success: true, message: 'All activity logs cleared successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Modify / update a log
app.put('/api/logs/:id', (req, res) => {
  try {
    const updated = db.updateLog(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Log entry not found' });
    }
    res.json({ success: true, log: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resend an email from a log entry
app.post('/api/logs/:id/resend', async (req, res) => {
  try {
    const logs = db.getLogs();
    const log = logs.find(l => String(l.id) === String(req.params.id));
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log entry not found' });
    }

    const targetEmail = req.body.recipientEmail || log.customerEmail;
    const templateId = log.templateId || 1;

    let checkout = null;
    if (log.checkoutId && !log.checkoutId.startsWith('test_')) {
      checkout = await shopifyClient.getCheckoutById(log.checkoutId);
    }

    let result;
    if (checkout) {
      const rendered = emailService.renderTemplate(templateId, checkout, req.body.customSubject || log.subject);
      result = await emailService.sendEmail({
        to: targetEmail,
        subject: rendered.subject,
        html: rendered.html,
        checkoutId: checkout.id,
        templateId,
        mode: 'manual-resend',
        customerName: checkout.fullName
      });
    } else {
      result = await emailService.sendTestEmail(targetEmail, templateId);
    }

    res.json({ success: true, message: `Email successfully re-dispatched to ${targetEmail}`, result });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Retry all failed logs with 1 click
app.post('/api/logs/retry-all-failed', async (req, res) => {
  try {
    const logs = db.getLogs();
    const failedLogs = logs.filter(l => l.status === 'failed');
    if (failedLogs.length === 0) {
      return res.json({ success: true, count: 0, message: 'No failed email logs to retry.' });
    }

    let retriedCount = 0;
    let failedAgainCount = 0;

    for (const log of failedLogs) {
      try {
        const targetEmail = log.customerEmail;
        const templateId = log.templateId || 1;
        let checkout = null;
        if (log.checkoutId && !log.checkoutId.startsWith('test_')) {
          checkout = await shopifyClient.getCheckoutById(log.checkoutId);
        }

        if (checkout) {
          const rendered = emailService.renderTemplate(templateId, checkout, log.subject);
          await emailService.sendEmail({
            to: targetEmail,
            subject: rendered.subject,
            html: rendered.html,
            checkoutId: checkout.id,
            templateId,
            mode: 'batch-retry',
            customerName: checkout.fullName
          });
        } else {
          await emailService.sendTestEmail(targetEmail, templateId);
        }

        db.updateLog(log.id, { status: 'retried', resolvedAt: new Date().toISOString() });
        retriedCount++;
      } catch (err) {
        failedAgainCount++;
        console.error(`[Retry All Failed] Could not retry log ${log.id} for ${log.customerEmail}:`, err.message);
      }
      await new Promise(r => setTimeout(r, 400));
    }

    res.json({
      success: true,
      totalFailed: failedLogs.length,
      retriedCount,
      failedAgainCount,
      message: `Retried ${retriedCount} of ${failedLogs.length} failed dispatches.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. Templates API
app.get('/api/templates/:id', (req, res) => {
  try {
    const id = req.params.id;
    const html = emailService.getTemplateHtml(id);
    const settings = db.getSettings();
    const config = settings.templatesConfig.find(t => t.id === Number(id));
    res.json({ id, config, html });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/templates/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { html, subject, name, minAgeHours, maxAgeHours, enabled } = req.body;

    const settings = db.getSettings();
    const configIndex = settings.templatesConfig.findIndex(t => t.id === Number(id));

    if (configIndex !== -1) {
      if (subject !== undefined) settings.templatesConfig[configIndex].subject = subject;
      if (name !== undefined) settings.templatesConfig[configIndex].name = name;
      if (minAgeHours !== undefined) settings.templatesConfig[configIndex].minAgeHours = Number(minAgeHours);
      if (maxAgeHours !== undefined) settings.templatesConfig[configIndex].maxAgeHours = Number(maxAgeHours);
      if (enabled !== undefined) settings.templatesConfig[configIndex].enabled = Boolean(enabled);
      db.updateSettings({ templatesConfig: settings.templatesConfig });
    }

    if (html !== undefined) {
      const filename = `template${id}.html`;
      fs.writeFileSync(path.join(__dirname, 'templates', filename), html, 'utf-8');
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Automation Engine on Launch if enabled
if (db.getSettings().automationEnabled) {
  automationEngine.start();
}

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`The Dental Shaman - Abandoned Cart App`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Connected to: shop.thedentalshaman.com (myjrue-ku.myshopify.com)`);
  console.log(`Master Access Code configured: ${db.data.masterAccessCode}`);
  console.log(`====================================================`);
});
