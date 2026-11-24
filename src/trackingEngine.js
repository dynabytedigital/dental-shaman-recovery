/**
 * Tracking & Telemetry Engine for Cloudflare Workers
 * Precision click tracking (/t/c/), open tracking (/t/o/), and zero-mismatch Shopify attribution
 */

// 1x1 Transparent GIF buffer
const TRANSPARENT_GIF_BYTES = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

export class TrackingEngine {
  static generateId(prefix = 'trk') {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 7);
    return `${prefix}_${ts}_${rand}`;
  }

  /**
   * Rewrites links in email HTML to go through the Cloudflare Worker click router
   */
  static wrapEmailHtmlWithTracking(html, dispatchId, workerBaseUrl, meta = {}) {
    if (!html || !dispatchId) return html;
    const baseUrl = (workerBaseUrl || '').replace(/\/$/, '');

    const campaign = encodeURIComponent(meta.campaign || 'recovery');
    const season = encodeURIComponent(meta.season || 'evergreen');
    const trackingRef = encodeURIComponent(meta.tds_trk || dispatchId);

    // Replace all links targeting shop.thedentalshaman.com
    const wrappedHtml = html.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (match, url) => {
      // Don't wrap mailto:, tel:, or tracking pixels
      if (url.startsWith('mailto:') || url.startsWith('tel:') || url.includes('/t/c/') || url.includes('/t/o/')) {
        return match;
      }
      const trackingUrl = `${baseUrl}/t/c/${dispatchId}?dest=${encodeURIComponent(url)}&campaign=${campaign}&season=${season}&tds_trk=${trackingRef}&element=email_body`;
      return `href="${trackingUrl}"`;
    });

    // Append open tracking pixel before </body> or at the end
    const pixel = `<img src="${baseUrl}/t/o/${dispatchId}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;opacity:0;" alt="" />`;
    if (wrappedHtml.includes('</body>')) {
      return wrappedHtml.replace('</body>', `${pixel}</body>`);
    }
    return wrappedHtml + pixel;
  }

  /**
   * Generates custom button HTML and tracking URL for campaign team members
   */
  static generateButtonSnippet({
    text = 'Complete Your Order',
    destination = 'https://shop.thedentalshaman.com/cart',
    campaign = 'campaign',
    season = 'evergreen',
    element = 'cta_button',
    trackingCode = 'TDS-REF-01',
    bgColor = '#2D8B7A',
    textColor = '#ffffff',
    borderRadius = '8px',
    paddingV = '14px',
    paddingH = '32px',
    workerBaseUrl = 'https://dental-shaman-recovery.aador-fit.workers.dev',
    dispatchId = '{{dispatch_id}}'
  }) {
    const baseUrl = workerBaseUrl.replace(/\/$/, '');
    const trackingUrl = `${baseUrl}/t/c/${dispatchId}?dest=${encodeURIComponent(destination)}&campaign=${encodeURIComponent(campaign)}&season=${encodeURIComponent(season)}&element=${encodeURIComponent(element)}&tds_trk=${encodeURIComponent(trackingCode)}`;

    const buttonHtml = `<!-- TDS Bulletproof Button -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px auto; border-collapse:separate;">
  <tr>
    <td align="center" bgcolor="${bgColor}" style="border-radius:${borderRadius}; background-color:${bgColor};">
      <a href="${trackingUrl}" target="_blank" style="display:inline-block; padding:${paddingV} ${paddingH}; font-family:Arial,sans-serif; font-size:16px; font-weight:bold; color:${textColor}; text-decoration:none; border-radius:${borderRadius}; letter-spacing:0.5px; text-transform:uppercase;">
        ${text} &rarr;
      </a>
    </td>
  </tr>
</table>`;

    return {
      trackingUrl,
      buttonHtml
    };
  }

  /**
   * Processes incoming click, logs to D1, and constructs 302 Redirect to destination with Shopify UTMs
   */
  static async handleClick(request, env, dispatchId) {
    const url = new URL(request.url);
    const destParam = url.searchParams.get('dest') || 'https://shop.thedentalshaman.com';
    const campaign = url.searchParams.get('campaign') || 'recovery';
    const season = url.searchParams.get('season') || 'evergreen';
    const element = url.searchParams.get('element') || 'button';
    const tds_trk = url.searchParams.get('tds_trk') || dispatchId;

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const clickId = this.generateId('clk');
    const nowIso = new Date().toISOString();

    // 1. Record in D1
    try {
      await env.DB.prepare(
        `INSERT INTO clicks (id, timestamp, dispatch_id, target_url, destination, campaign, season, element, tds_trk, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(clickId, nowIso, dispatchId, destParam, destParam, campaign, season, element, tds_trk, ip, userAgent).run();

      // Update email_logs
      await env.DB.prepare(
        `UPDATE email_logs SET clicked = 1 WHERE id = ? OR checkout_id = ?`
      ).bind(dispatchId, dispatchId).run();
    } catch (err) {
      console.error('[TrackingEngine] Click logging error:', err.message);
    }

    // 2. Build final Shopify Destination URL with UTM parameters
    let finalUrl;
    try {
      finalUrl = new URL(destParam);
    } catch (e) {
      finalUrl = new URL('https://shop.thedentalshaman.com');
    }

    finalUrl.searchParams.set('utm_source', 'dental_shaman');
    finalUrl.searchParams.set('utm_medium', 'email');
    finalUrl.searchParams.set('utm_campaign', campaign);
    finalUrl.searchParams.set('utm_content', element);
    finalUrl.searchParams.set('utm_term', season);
    finalUrl.searchParams.set('tds_trk', tds_trk);

    // Return 302 Found redirect
    return Response.redirect(finalUrl.toString(), 302);
  }

  /**
   * Processes incoming open pixel, logs to D1, and returns 1x1 transparent GIF
   */
  static async handleOpen(request, env, dispatchId) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const openId = this.generateId('opn');
    const nowIso = new Date().toISOString();

    try {
      await env.DB.prepare(
        `INSERT INTO opens (id, timestamp, dispatch_id, ip, user_agent) VALUES (?, ?, ?, ?, ?)`
      ).bind(openId, nowIso, dispatchId, ip, userAgent).run();

      await env.DB.prepare(
        `UPDATE email_logs SET opened = 1 WHERE id = ? OR checkout_id = ?`
      ).bind(dispatchId, dispatchId).run();
    } catch (err) {
      console.error('[TrackingEngine] Open logging error:', err.message);
    }

    return new Response(TRANSPARENT_GIF_BYTES, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}
