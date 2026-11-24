import { SmtpClient } from './smtpClient.js';
import { ShopifyClient } from './shopifyClient.js';
import { TrackingEngine } from './trackingEngine.js';
import { renderTemplate, TEMPLATE_CONFIGS } from './templates.js';
import { getDashboardHtml } from './dashboardHtml.js';

export default {
  /**
   * Main HTTP Fetch Handler
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers for API
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Telemetry Click Tracking: /t/c/:dispatchId
    if (path.startsWith('/t/c/')) {
      const dispatchId = path.split('/')[3] || 'unknown';
      return await TrackingEngine.handleClick(request, env, dispatchId);
    }

    // 2. Telemetry Open Tracking Pixel: /t/o/:dispatchId
    if (path.startsWith('/t/o/')) {
      const dispatchId = path.split('/')[3] || 'unknown';
      return await TrackingEngine.handleOpen(request, env, dispatchId);
    }

    // 3. Operator UI / Dashboard
    if (path === '/' || path === '/dashboard') {
      return new Response(getDashboardHtml(env), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 4. API: Stats
    if (path === '/api/stats' && request.method === 'GET') {
      try {
        const shopify = new ShopifyClient(env);
        const checkouts = await shopify.getRecentCheckouts(168, 50);

        // Query D1 logs
        const logsCountRes = await env.DB.prepare('SELECT COUNT(*) as count FROM email_logs').first();
        const totalSent = logsCountRes?.count || 0;

        const opensCountRes = await env.DB.prepare('SELECT COUNT(*) as count FROM opens').first();
        const totalOpens = opensCountRes?.count || 0;

        const clicksCountRes = await env.DB.prepare('SELECT COUNT(*) as count FROM clicks').first();
        const totalClicks = clicksCountRes?.count || 0;

        const pipelineValue = checkouts.reduce((acc, c) => acc + parseFloat(c.totalPrice || 0), 0);
        const openRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;
        const clickRate = totalSent > 0 ? Math.round((totalClicks / totalSent) * 100) : 0;

        return Response.json({
          totalCheckouts: checkouts.length,
          pipelineValue,
          totalSent,
          openRate,
          clickRate,
          recentCheckouts: checkouts.slice(0, 10)
        }, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // 5. API: All Checkouts
    if (path === '/api/checkouts' && request.method === 'GET') {
      try {
        const shopify = new ShopifyClient(env);
        const checkouts = await shopify.getRecentCheckouts(336, 100);
        return Response.json(checkouts, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // 6. API: Logs
    if (path === '/api/logs' && request.method === 'GET') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 50'
        ).all();
        return Response.json(results || [], { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // 7. API: Send Stage Manually
    if (path === '/api/send-stage' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { checkoutId, stageId } = body;
        if (!checkoutId || !stageId) {
          return Response.json({ error: 'checkoutId and stageId required' }, { status: 400, headers: corsHeaders });
        }

        const shopify = new ShopifyClient(env);
        const checkout = await shopify.getCheckoutById(checkoutId);
        if (!checkout) {
          return Response.json({ error: 'Checkout not found' }, { status: 404, headers: corsHeaders });
        }

        const rendered = renderTemplate(stageId, checkout);
        const dispatchId = TrackingEngine.generateId(`stg${stageId}`);
        const workerBaseUrl = url.origin;

        // Wrap tracking links & inject open pixel
        const trackedHtml = TrackingEngine.wrapEmailHtmlWithTracking(
          rendered.html,
          dispatchId,
          workerBaseUrl,
          { campaign: 'recovery_manual', season: 'stage_' + stageId, tds_trk: `TDS-REC-S${stageId}` }
        );

        // Send via Google Workspace SMTP over direct TLS socket
        const smtp = new SmtpClient({
          host: env.SMTP_HOST || 'smtp.gmail.com',
          port: env.SMTP_PORT || 465,
          user: env.SMTP_USER || 'shop@thedentalshaman.com',
          pass: env.SMTP_PASS || 'fyrteoildyxulyeh'
        });

        const sendResult = await smtp.sendEmail({
          fromName: env.DEFAULT_FROM_NAME || 'Dr. Marc Mortiboys | The Dental Shaman',
          fromEmail: env.DEFAULT_FROM_EMAIL || 'shop@thedentalshaman.com',
          replyTo: env.DEFAULT_REPLY_TO || 'shop@thedentalshaman.com',
          to: checkout.email,
          subject: rendered.subject,
          html: trackedHtml
        });

        // Record in D1 email_logs
        await env.DB.prepare(
          `INSERT INTO email_logs (id, sent_at, checkout_id, customer_email, customer_name, template_id, template_name, subject, status, mode, message_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          dispatchId,
          new Date().toISOString(),
          String(checkout.id),
          checkout.email,
          checkout.fullName,
          Number(stageId),
          `Stage ${stageId}`,
          rendered.subject,
          'sent',
          'manual',
          sendResult.messageId
        ).run();

        return Response.json({ success: true, messageId: sendResult.messageId }, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // 8. API: Test Email
    if (path === '/api/test-email' && request.method === 'POST') {
      try {
        const body = await request.json();
        const toEmail = body.to || 'devnayem30@gmail.com';

        const mockCheckout = {
          id: 'TEST-001',
          firstName: 'Marc',
          fullName: 'Marc Mortiboys',
          email: toEmail,
          totalPrice: '98.00',
          currencySymbol: '£',
          items: [
            {
              title: 'Water Flosser',
              variantTitle: 'Blue',
              quantity: 1,
              price: '88.00',
              image: 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/ozone-water-flosser-blue.png?v=1794725190'
            }
          ]
        };

        const rendered = renderTemplate(1, mockCheckout, 'Test: Cloudflare Worker Recovery Engine Connected');
        const smtp = new SmtpClient({
          host: env.SMTP_HOST || 'smtp.gmail.com',
          port: env.SMTP_PORT || 465,
          user: env.SMTP_USER || 'shop@thedentalshaman.com',
          pass: env.SMTP_PASS || 'fyrteoildyxulyeh'
        });

        const sendResult = await smtp.sendEmail({
          fromName: env.DEFAULT_FROM_NAME || 'Dr. Marc Mortiboys | The Dental Shaman',
          fromEmail: env.DEFAULT_FROM_EMAIL || 'shop@thedentalshaman.com',
          replyTo: env.DEFAULT_REPLY_TO || 'shop@thedentalshaman.com',
          to: toEmail,
          subject: rendered.subject,
          html: rendered.html
        });

        return Response.json({ success: true, messageId: sendResult.messageId }, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // 9. Webhook: Checkouts
    if (path === '/api/webhooks/checkouts' && request.method === 'POST') {
      try {
        const rawCheckout = await request.json();
        const shopify = new ShopifyClient(env);
        const checkout = shopify.parseRawCheckout(rawCheckout);

        if (!checkout || !checkout.email || checkout.isCompleted) {
          return new Response('Ignored', { status: 200 });
        }

        // Insert / Update customer sequence in D1
        await env.DB.prepare(
          `INSERT INTO customer_sequences (checkout_id, customer_email, customer_name, created_at, updated_at, active, current_stage, stages_sent, total_price, currency)
           VALUES (?, ?, ?, ?, ?, 1, 0, '[]', ?, ?)
           ON CONFLICT(checkout_id) DO UPDATE SET updated_at = excluded.updated_at`
        ).bind(
          String(checkout.id),
          checkout.email,
          checkout.fullName,
          checkout.createdAt,
          new Date().toISOString(),
          parseFloat(checkout.totalPrice || 0),
          checkout.currency
        ).run();

        return new Response('Enrolled', { status: 200 });
      } catch (err) {
        return new Response('Webhook error: ' + err.message, { status: 500 });
      }
    }

    // 10. Webhook: Orders
    if (path === '/api/webhooks/orders' && request.method === 'POST') {
      try {
        const order = await request.json();
        const email = order.email || order.customer?.email;
        if (email) {
          // Deactivate sequence upon order conversion
          await env.DB.prepare(
            `UPDATE customer_sequences SET active = 0 WHERE customer_email = ?`
          ).bind(email).run();

          await env.DB.prepare(
            `UPDATE email_logs SET converted = 1 WHERE customer_email = ?`
          ).bind(email).run();
        }
        return new Response('Order acknowledged', { status: 200 });
      } catch (err) {
        return new Response('Webhook error: ' + err.message, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },

  /**
   * Cloudflare Cron Trigger (Runs automatically every 15 minutes at $0 cost forever)
   */
  async scheduled(event, env, ctx) {
    console.log('[Cron Trigger] Starting automated cadence scan...');
    const shopify = new ShopifyClient(env);
    const smtp = new SmtpClient({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: env.SMTP_PORT || 465,
      user: env.SMTP_USER || 'shop@thedentalshaman.com',
      pass: env.SMTP_PASS || 'fyrteoildyxulyeh'
    });

    try {
      const checkouts = await shopify.getRecentCheckouts(336, 100);
      const workerBaseUrl = 'https://dental-shaman-recovery.aador-fit.workers.dev';

      for (const co of checkouts) {
        if (!co.email || co.isCompleted) continue;

        // Skip historical checkouts older than 14 days
        if (co.ageHours > 336) continue;

        // Check which stages have already been sent to this checkout
        const { results } = await env.DB.prepare(
          `SELECT template_id FROM email_logs WHERE checkout_id = ?`
        ).bind(String(co.id)).all();

        const sentTemplateIds = new Set((results || []).map(r => Number(r.template_id)));

        // Evaluate Stage 1 to 5 against ageHours
        for (const stage of TEMPLATE_CONFIGS) {
          if (!stage.enabled) continue;
          if (sentTemplateIds.has(stage.id)) continue;

          // Check if checkout age matches stage window
          if (co.ageHours >= stage.minAgeHours && co.ageHours <= stage.maxAgeHours) {
            console.log(`[Cron Trigger] Due: Dispatching Stage ${stage.id} to ${co.email} (Cart age: ${co.ageHours}h)`);

            const rendered = renderTemplate(stage.id, co);
            const dispatchId = TrackingEngine.generateId(`cron_s${stage.id}`);

            const trackedHtml = TrackingEngine.wrapEmailHtmlWithTracking(
              rendered.html,
              dispatchId,
              workerBaseUrl,
              { campaign: 'automated_recovery', season: `stage_${stage.id}`, tds_trk: `TDS-AUTO-S${stage.id}` }
            );

            try {
              const sendRes = await smtp.sendEmail({
                fromName: env.DEFAULT_FROM_NAME || 'Dr. Marc Mortiboys | The Dental Shaman',
                fromEmail: env.DEFAULT_FROM_EMAIL || 'shop@thedentalshaman.com',
                replyTo: env.DEFAULT_REPLY_TO || 'shop@thedentalshaman.com',
                to: co.email,
                subject: rendered.subject,
                html: trackedHtml
              });

              // Log success
              await env.DB.prepare(
                `INSERT INTO email_logs (id, sent_at, checkout_id, customer_email, customer_name, template_id, template_name, subject, status, mode, message_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                dispatchId,
                new Date().toISOString(),
                String(co.id),
                co.email,
                co.fullName,
                stage.id,
                stage.name,
                rendered.subject,
                'sent',
                'auto',
                sendRes.messageId
              ).run();

              // Safe rate-limit delay (2s) between recipients
              await SmtpClient.sleep(2000);
            } catch (sendErr) {
              console.error(`[Cron Trigger] Send failed for ${co.email}:`, sendErr.message);
            }

            // Only send one stage per cron run per customer
            break;
          }
        }
      }
    } catch (err) {
      console.error('[Cron Trigger] Scan error:', err.message);
    }
  }
};
