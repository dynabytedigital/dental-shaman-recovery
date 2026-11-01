const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const db = require('./database');

class EmailService {
  constructor() {
    this.templatesDir = path.join(__dirname, 'templates');
  }

  getTransporter() {
    const settings = db.getSettings();
    const smtp = settings.smtp || {};

    const host = smtp.host || process.env.SMTP_HOST || 'smtp.hostinger.com';
    const port = parseInt(smtp.port || process.env.SMTP_PORT || '465', 10);
    const secure = (smtp.secure !== undefined) ? Boolean(smtp.secure) : (port === 465 || process.env.SMTP_SECURE === 'true');
    const user = smtp.user || process.env.SMTP_USER || 'shop@thedentalshaman.com';
    const pass = smtp.pass || process.env.SMTP_PASS;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 6000,
      greetingTimeout: 6000,
      socketTimeout: 8000
    });
  }

  async verifyConnection() {
    const settings = db.getSettings();

    if (settings.emailService === 'resend') {
      if (!settings.apiKey) throw new Error('Resend API Key is required');
      const res = await axios.get('https://api.resend.com/api-keys', {
        headers: { Authorization: `Bearer ${settings.apiKey}` }
      });
      return { success: true, message: 'Resend API authenticated successfully' };
    }

    if (settings.emailService === 'sendgrid') {
      if (!settings.apiKey) throw new Error('SendGrid API Key is required');
      const res = await axios.get('https://api.sendgrid.com/v3/user/profile', {
        headers: { Authorization: `Bearer ${settings.apiKey}` }
      });
      return { success: true, message: 'SendGrid API authenticated successfully' };
    }

    // Default SMTP verification
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return { success: true, message: 'SMTP connection established successfully' };
    } catch (err) {
      const isTimeout = err.code === 'ETIMEDOUT' || err.message.includes('timeout') || err.message.includes('Connection timeout');
      if (isTimeout) {
        throw new Error('Render Free Tier blocks raw SMTP ports 465 & 587. Please switch to Resend API in Settings for instant sub-second delivery, or upgrade Render service to Starter ($7/mo) to unblock ports.');
      }
      throw err;
    }
  }

  getTemplateHtml(templateId) {
    const settings = db.getSettings();
    const config = settings.templatesConfig.find(t => t.id === Number(templateId));
    const filename = config ? config.file : `template${templateId}.html`;
    const filePath = path.join(this.templatesDir, filename);

    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    throw new Error(`Template file ${filename} not found`);
  }

  generateCartItemsHtml(items, currencySymbol = '£') {
    if (!items || items.length === 0) {
      return '<p style="color: #6d7175; font-size: 14px; margin: 12px 0;">Your selected items</p>';
    }

    const defaultImg = 'https://cdn.shopify.com/s/files/1/0946/8238/2665/files/ozone-water-flosser-white-compact-oral-irrigator.jpg?v=1751408148';

    let rows = items.map(item => {
      const variant = item.variantTitle && item.variantTitle !== 'Default Title' 
        ? `<div style="font-size: 13px; color: #6d7175; margin-top: 2px;">${item.variantTitle}</div>` 
        : '';
      
      const itemImg = item.image || (item.title?.toLowerCase().includes('flosser') ? defaultImg : '');
      const imgHtml = itemImg 
        ? `<img src="${itemImg}" alt="${item.title}" style="width: 64px; height: 64px; object-fit: contain; border-radius: 6px; border: 1px solid #e5e7eb; margin-right: 16px;" />`
        : '';

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 16px 0; vertical-align: middle;">
            <div style="display: flex; align-items: center;">
              ${imgHtml}
              <div>
                <div style="font-size: 14px; font-weight: 600; color: #111827; line-height: 1.4;">
                  ${item.title}
                </div>
                ${variant}
                <div style="font-size: 13px; color: #6d7175; margin-top: 2px;">Quantity: ${item.quantity || 1}</div>
              </div>
            </div>
          </td>
          <td style="padding: 16px 0; text-align: right; vertical-align: middle; font-size: 14px; font-weight: 600; color: #111827; white-space: nowrap;">
            ${currencySymbol}${parseFloat(item.price || 0).toFixed(2)}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderTemplate(templateId, checkout, customSubject = null) {
    const settings = db.getSettings();
    const templateConfig = settings.templatesConfig.find(t => t.id === Number(templateId)) || {
      id: templateId,
      name: `Template ${templateId}`,
      subject: 'Did you leave something behind?'
    };

    let rawHtml = this.getTemplateHtml(templateId);

    const firstName = checkout.firstName || 'there';
    const fullName = checkout.fullName || 'there';
    const checkoutUrl = checkout.abandonedCheckoutUrl || 'https://shop.thedentalshaman.com';
    const currency = checkout.currencySymbol || '£';
    const totalPrice = `${currency}${parseFloat(checkout.totalPrice || 0).toFixed(2)}`;
    const cartItemsHtml = this.generateCartItemsHtml(checkout.items, currency);
    const shopName = 'The Dental Shaman';

    let subject = customSubject || templateConfig.subject;
    subject = subject
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/\{\{customer_name\}\}/g, fullName)
      .replace(/\{\{total_price\}\}/g, totalPrice)
      .replace(/\{\{shop_name\}\}/g, shopName);

    const renderedHtml = rawHtml
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/\{\{customer_name\}\}/g, fullName)
      .replace(/\{\{customer_email\}\}/g, checkout.email || '')
      .replace(/\{\{checkout_url\}\}/g, checkoutUrl)
      .replace(/\{\{total_price\}\}/g, totalPrice)
      .replace(/\{\{cart_items_html\}\}/g, cartItemsHtml)
      .replace(/\{\{shop_name\}\}/g, shopName)
      .replace(/\{\{discount_code\}\}/g, 'HOLISTIC10');

    return {
      templateConfig,
      subject,
      html: renderedHtml
    };
  }

  async sendEmail({ to, subject, html, checkoutId, templateId, mode = 'manual', customerName = '' }) {
    const settings = db.getSettings();
    const fromName = settings.senderName || 'The Dental Shaman';
    const fromEmail = settings.senderEmail || 'shop@thedentalshaman.com';
    const replyTo = settings.replyTo || fromEmail;

    if (!to || !to.includes('@')) {
      throw new Error(`Invalid recipient email: "${to}"`);
    }

    if (db.isSuppressed(to)) {
      throw new Error(`Email ${to} is suppressed / opted-out.`);
    }

    try {
      let messageId = null;

      const resendApiKey = settings.apiKey || process.env.RESEND_API_KEY;
      if (settings.emailService === 'resend' || (!settings.emailService && resendApiKey)) {
        if (!resendApiKey) throw new Error('Resend API Key is required. Please add it in Settings.');
        const res = await axios.post(
          'https://api.resend.com/emails',
          {
            from: `${fromName} <${fromEmail}>`,
            to: [to],
            reply_to: replyTo,
            subject,
            html
          },
          {
            headers: {
              Authorization: `Bearer ${resendApiKey.trim()}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        messageId = res.data.id;
      } else if (settings.emailService === 'sendgrid') {
        const sendgridKey = settings.apiKey || process.env.SENDGRID_API_KEY;
        if (!sendgridKey) throw new Error('SendGrid API Key is required. Please add it in Settings.');
        const res = await axios.post(
          'https://api.sendgrid.com/v3/mail/send',
          {
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail, name: fromName },
            reply_to: { email: replyTo },
            subject,
            content: [{ type: 'text/html', value: html }]
          },
          {
            headers: {
              Authorization: `Bearer ${sendgridKey.trim()}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        messageId = 'sendgrid_' + Date.now();
      } else {
        // SMTP
        const transporter = this.getTransporter();
        const info = await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to,
          replyTo,
          subject,
          html
        });
        messageId = info.messageId;
      }

      // Log success
      const logEntry = db.addLog({
        checkoutId: checkoutId || null,
        customerEmail: to,
        customerName,
        templateId,
        templateName: settings.templatesConfig.find(t => t.id === Number(templateId))?.name || `Template ${templateId}`,
        subject,
        status: 'sent',
        mode,
        messageId
      });

      return { success: true, logEntry };
    } catch (error) {
      const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout') || error.message.includes('Connection timeout');
      const friendlyErrMsg = isTimeout
        ? 'Render Free Tier blocks raw SMTP ports 465 & 587. Please switch to Resend API in Settings for instant delivery, or upgrade Render instance to Starter ($7/mo) to unblock ports.'
        : error.message;

      console.error(`Failed to send email to ${to}:`, friendlyErrMsg);
      db.addLog({
        checkoutId: checkoutId || null,
        customerEmail: to,
        customerName,
        templateId,
        templateName: settings.templatesConfig.find(t => t.id === Number(templateId))?.name || `Template ${templateId}`,
        subject,
        status: 'failed',
        mode,
        error: friendlyErrMsg
      });
      throw new Error(friendlyErrMsg);
    }
  }

  async sendTestEmail(targetEmail, templateId = 1) {
    const targetTemplateId = Number(templateId) || 1;
    const settings = db.getSettings();
    const templateConfig = (settings.templatesConfig || []).find(t => t.id === targetTemplateId);

    const dummyCheckout = {
      firstName: 'Dr. Marc',
      fullName: 'Dr. Marc Mortiboys',
      email: targetEmail,
      abandonedCheckoutUrl: 'https://shop.thedentalshaman.com/checkouts/test-sample-recovery',
      currencySymbol: '£',
      totalPrice: '122.58',
      items: [
        {
          title: 'The Dental Shaman Water Flosser : Deep Clean, Chemical-Free Oral Care',
          variantTitle: 'White',
          quantity: 1,
          price: '122.58'
        }
      ]
    };

    const subjectPrefix = `[Test Stage ${targetTemplateId}] `;
    const baseSubject = templateConfig ? templateConfig.subject : 'The Dental Shaman Abandoned Cart Recovery';

    const rendered = this.renderTemplate(targetTemplateId, dummyCheckout, subjectPrefix + baseSubject);
    return await this.sendEmail({
      to: targetEmail,
      subject: rendered.subject,
      html: rendered.html,
      checkoutId: 'test_checkout_' + Date.now(),
      templateId: targetTemplateId,
      mode: 'manual',
      customerName: 'Test Recipient'
    });
  }
}

module.exports = new EmailService();
