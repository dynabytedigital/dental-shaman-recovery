import { connect } from 'cloudflare:sockets';

/**
 * Robust Google Workspace SMTP client over direct TLS using Cloudflare Sockets
 */
export class SmtpClient {
  constructor(options = {}) {
    this.host = options.host || 'smtp.gmail.com';
    this.port = Number(options.port) || 465;
    this.user = options.user || 'shop@thedentalshaman.com';
    this.pass = options.pass || 'fyrteoildyxulyeh';
  }

  /**
   * Helper delay utility
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reads an SMTP reply from the reader until a line with code + space is found
   */
  async readReply(reader, decoder) {
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\r\n');
      let finished = false;
      for (const line of lines) {
        if (/^\d{3}\s/.test(line)) {
          finished = true;
          break;
        }
      }
      if (finished) break;
    }
    return buffer;
  }

  /**
   * Sends a single command and awaits the server reply
   */
  async sendCommand(writer, encoder, reader, decoder, cmd) {
    await writer.write(encoder.encode(cmd + '\r\n'));
    return await this.readReply(reader, decoder);
  }

  /**
   * Encodes a string to standard Base64 in Cloudflare Workers
   */
  toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Encodes raw string into MIME quoted-printable or UTF-8 B-encoded header
   */
  encodeHeader(text) {
    return `=?UTF-8?B?${this.toBase64(text)}?=`;
  }

  /**
   * Single low-level SMTP send attempt
   */
  async _attemptSend({ fromName, fromEmail, to, replyTo, subject, html }) {
    const socket = connect(
      { hostname: this.host, port: this.port },
      { secureTransport: 'on' }
    );

    const reader = socket.readable.getReader();
    const writer = socket.writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    try {
      // 1. Read initial banner (220)
      const greeting = await this.readReply(reader, decoder);
      if (!greeting.startsWith('220')) {
        throw new Error(`SMTP Greeting failed: ${greeting.trim()}`);
      }

      // 2. EHLO localhost
      const ehlo = await this.sendCommand(writer, encoder, reader, decoder, 'EHLO localhost');
      if (!ehlo.includes('250')) {
        throw new Error(`EHLO failed: ${ehlo.trim()}`);
      }

      // 3. AUTH LOGIN
      const authInit = await this.sendCommand(writer, encoder, reader, decoder, 'AUTH LOGIN');
      if (!authInit.startsWith('334')) {
        throw new Error(`AUTH LOGIN initiation failed: ${authInit.trim()}`);
      }

      // 4. Send username
      const userResp = await this.sendCommand(writer, encoder, reader, decoder, this.toBase64(this.user));
      if (!userResp.startsWith('334')) {
        throw new Error(`Username rejected: ${userResp.trim()}`);
      }

      // 5. Send password
      const passResp = await this.sendCommand(writer, encoder, reader, decoder, this.toBase64(this.pass));
      if (!passResp.startsWith('235')) {
        throw new Error(`Google Workspace authentication failed: ${passResp.trim()}`);
      }

      // 6. MAIL FROM
      const mailFromResp = await this.sendCommand(writer, encoder, reader, decoder, `MAIL FROM:<${fromEmail || this.user}>`);
      if (!mailFromResp.startsWith('250')) {
        throw new Error(`MAIL FROM rejected: ${mailFromResp.trim()}`);
      }

      // 7. RCPT TO
      const rcptResp = await this.sendCommand(writer, encoder, reader, decoder, `RCPT TO:<${to}>`);
      if (!rcptResp.startsWith('250')) {
        throw new Error(`RCPT TO rejected: ${rcptResp.trim()}`);
      }

      // 8. DATA
      const dataResp = await this.sendCommand(writer, encoder, reader, decoder, 'DATA');
      if (!dataResp.startsWith('354')) {
        throw new Error(`DATA initiation rejected: ${dataResp.trim()}`);
      }

      // 9. Build RFC 2822 MIME message
      const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 10)}@thedentalshaman.com>`;
      const dateHeader = new Date().toUTCString();
      const encodedSubject = this.encodeHeader(subject);
      const encodedFromName = this.encodeHeader(fromName || 'The Dental Shaman');

      const bodyBase64 = this.toBase64(html);
      // Chunk base64 body to 76 chars per line per RFC specifications
      const chunkedBody = bodyBase64.match(/.{1,76}/g)?.join('\r\n') || bodyBase64;

      const rfcMessage = [
        `From: "${encodedFromName}" <${fromEmail || this.user}>`,
        `To: <${to}>`,
        `Reply-To: <${replyTo || fromEmail || this.user}>`,
        `Subject: ${encodedSubject}`,
        `Date: ${dateHeader}`,
        `Message-ID: ${messageId}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        '',
        chunkedBody,
        '.'
      ].join('\r\n');

      const sendResp = await this.sendCommand(writer, encoder, reader, decoder, rfcMessage);
      if (!sendResp.startsWith('250')) {
        throw new Error(`Email body submission failed: ${sendResp.trim()}`);
      }

      // 10. QUIT cleanly
      try {
        await this.sendCommand(writer, encoder, reader, decoder, 'QUIT');
      } catch (e) {
        // Ignored on teardown
      }

      return {
        success: true,
        messageId,
        timestamp: new Date().toISOString()
      };
    } finally {
      try { writer.releaseLock(); } catch (e) {}
      try { reader.releaseLock(); } catch (e) {}
      try { socket.close(); } catch (e) {}
    }
  }

  /**
   * Sends an email with automatic retries on transient network/SMTP failures
   */
  async sendEmail(params, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this._attemptSend(params);
        return result;
      } catch (err) {
        lastError = err;
        console.warn(`[SmtpClient] Attempt ${attempt} failed: ${err.message}`);
        if (attempt < maxRetries) {
          // Exponential backoff delay (1s, 2s)
          await SmtpClient.sleep(attempt * 1000);
        }
      }
    }
    throw new Error(`Google Workspace delivery failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Batch dispatch with delay between recipients to prevent spam triggers
   */
  async sendBatch(emailList, delayMs = 1800, progressCallback = null) {
    const results = [];
    for (let i = 0; i < emailList.length; i++) {
      const email = emailList[i];
      try {
        const res = await this.sendEmail(email);
        results.push({ email: email.to, success: true, result: res });
        if (progressCallback) progressCallback(i + 1, emailList.length, true, null);
      } catch (err) {
        results.push({ email: email.to, success: false, error: err.message });
        if (progressCallback) progressCallback(i + 1, emailList.length, false, err.message);
      }

      // Add rate-limiting delay between customers (except for last item)
      if (i < emailList.length - 1 && delayMs > 0) {
        await SmtpClient.sleep(delayMs);
      }
    }
    return results;
  }
}
