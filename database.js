const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

const MASTER_ACCESS_CODE = process.env.MASTER_ACCESS_CODE || 'TDS-REC#FBC72E3C-E5D99DF0-04F10156';

const DEFAULT_DB = {
  masterAccessCode: MASTER_ACCESS_CODE,
  users: [],
  sessions: {},
  settings: {
    automationEnabled: false,
    scanIntervalMinutes: 15,
    minCooldownHours: 18,
    senderName: process.env.DEFAULT_FROM_NAME || 'Dr. Marc Mortiboys | The Dental Shaman',
    senderEmail: process.env.DEFAULT_FROM_EMAIL || 'shop@thedentalshaman.com',
    replyTo: process.env.DEFAULT_REPLY_TO || 'shop@thedentalshaman.com',
    emailService: 'smtp',
    smtp: {
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      user: 'shop@thedentalshaman.com',
      pass: 'mh1i-liei-n0u1-qa37'
    },
    apiKey: '',
    templatesConfig: [
      {
        id: 1,
        name: 'Stage 1: Cart Saved Check-in',
        minAgeHours: 1,
        maxAgeHours: 23,
        enabled: true,
        subject: 'Did something go wrong with your order, {{first_name}}?',
        file: 'template1.html'
      },
      {
        id: 2,
        name: "Stage 2: Dr. Marc's Story & Clinical Ozone",
        minAgeHours: 24,
        maxAgeHours: 47,
        enabled: true,
        subject: 'A note from Dr. Marc Mortiboys (BDS): The truth about flossing & ozone care',
        file: 'template2.html'
      },
      {
        id: 3,
        name: 'Stage 3: Social Proof & Gum Health',
        minAgeHours: 48,
        maxAgeHours: 71,
        enabled: true,
        subject: 'Real smiles, real relief: What happens when you switch to The Dental Shaman',
        file: 'template3.html'
      },
      {
        id: 4,
        name: 'Stage 4: Courtesy Incentive & eBook',
        minAgeHours: 72,
        maxAgeHours: 119,
        enabled: true,
        subject: 'A courtesy benefit has been extended to your order',
        file: 'template4.html'
      },
      {
        id: 5,
        name: 'Stage 5: Final Notice & Cart Expiration',
        minAgeHours: 120,
        maxAgeHours: 336,
        enabled: true,
        subject: 'Final Notice: We are releasing your reserved cart soon',
        file: 'template5.html'
      }
    ]
  },
  emailLogs: [],
  suppressions: []
};

class Database {
  constructor() {
    this.data = this.load();
    if (!this.data.users) this.data.users = [];
    if (!this.data.sessions) this.data.sessions = {};
    if (!this.data.customerSequences) this.data.customerSequences = {};
    if (!this.data.masterAccessCode) this.data.masterAccessCode = MASTER_ACCESS_CODE;

    // Ensure master admin user exists in users table
    if (!this.data.users.find(u => u.id === 'usr_master_admin')) {
      this.data.users.push({
        id: 'usr_master_admin',
        email: 'admin@thedentalshaman.com',
        name: 'Authorized Operator',
        createdAt: new Date().toISOString()
      });
      this.save();
    }
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const content = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('Error loading db.json, falling back to default:', e);
    }
    this.save(DEFAULT_DB);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }

  save(data = this.data) {
    try {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
      this.data = data;
    } catch (e) {
      console.error('Error saving db.json:', e);
    }
  }

  hashPassword(password) {
    const salt = 'shaman_salt_2026';
    return crypto.scryptSync(password, salt, 32).toString('hex');
  }

  verifyMasterAccessCode(code) {
    if (!code) return false;
    const raw = String(code).trim();
    const targetCode = process.env.MASTER_ACCESS_CODE || 'TDS-REC#FBC72E3C-E5D99DF0-04F10156';

    try {
      const hashA = crypto.createHash('sha256').update(raw).digest();
      const hashB = crypto.createHash('sha256').update(targetCode).digest();
      if (crypto.timingSafeEqual(hashA, hashB)) return true;
    } catch (e) {}

    const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const targetClean = targetCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean === targetClean) return true;

    return false;
  }

  authenticateWithAccessKey(accessKey, email = 'admin@thedentalshaman.com') {
    if (!this.verifyMasterAccessCode(accessKey)) {
      throw new Error('Invalid access code.');
    }
    const user = { id: 'usr_master_admin', email: email || 'admin@thedentalshaman.com', name: 'Authorized Operator' };
    const token = this.createSession('usr_master_admin', user);
    return { user, token };
  }

  createUser({ email, password, name, accessCode }) {
    if (!this.verifyMasterAccessCode(accessCode)) {
      throw new Error('Invalid master access code. Access denied.');
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      throw new Error('A valid email address is required.');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const existing = (this.data.users || []).find(u => u.email === cleanEmail);
    if (existing) {
      throw new Error('A user with this email address already exists.');
    }

    const user = {
      id: 'usr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
      email: cleanEmail,
      name: (name || cleanEmail.split('@')[0]).trim(),
      passwordHash: this.hashPassword(password),
      createdAt: new Date().toISOString()
    };

    this.data.users.push(user);
    this.save();

    const token = this.createSession(user.id);
    return { user: { id: user.id, email: user.email, name: user.name }, token };
  }

  authenticateUser({ email, password }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = (this.data.users || []).find(u => u.email === cleanEmail);
    if (!user) {
      throw new Error('Invalid credentials.');
    }

    const hash = this.hashPassword(password);
    if (user.passwordHash !== hash) {
      throw new Error('Invalid credentials.');
    }

    const token = this.createSession(user.id);
    return { user: { id: user.id, email: user.email, name: user.name }, token };
  }

  createSession(userId, userObj = null) {
    if (!this.data.sessions) this.data.sessions = {};
    const token = 'tok_' + crypto.randomBytes(32).toString('hex');
    this.data.sessions[token] = {
      userId,
      user: userObj || { id: userId, email: 'admin@thedentalshaman.com', name: 'Authorized Operator' },
      createdAt: new Date().toISOString()
    };
    this.save();
    return token;
  }

  validateSession(token) {
    if (!token) return null;
    const session = (this.data.sessions || {})[token];
    if (!session) return null;

    if (session.userId === 'usr_master_admin') {
      return session.user || { id: 'usr_master_admin', email: 'admin@thedentalshaman.com', name: 'Authorized Operator' };
    }

    const user = (this.data.users || []).find(u => u.id === session.userId);
    if (user) {
      return { id: user.id, email: user.email, name: user.name };
    }

    if (session.user) {
      return session.user;
    }

    return null;
  }

  deleteSession(token) {
    if (this.data.sessions && this.data.sessions[token]) {
      delete this.data.sessions[token];
      this.save();
    }
  }

  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }

  getLogs() {
    return this.data.emailLogs || [];
  }

  addLog(logEntry) {
    if (!this.data.emailLogs) this.data.emailLogs = [];
    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      sentAt: new Date().toISOString(),
      ...logEntry
    };
    this.data.emailLogs.unshift(entry);
    if (this.data.emailLogs.length > 500) {
      this.data.emailLogs = this.data.emailLogs.slice(0, 500);
    }
    this.save();
    return entry;
  }

  deleteLog(logId) {
    if (!this.data.emailLogs) return false;
    const initialLen = this.data.emailLogs.length;
    this.data.emailLogs = this.data.emailLogs.filter(l => String(l.id) !== String(logId));
    if (this.data.emailLogs.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  clearLogs() {
    this.data.emailLogs = [];
    this.save();
    return true;
  }

  updateLog(logId, updates) {
    if (!this.data.emailLogs) return null;
    const log = this.data.emailLogs.find(l => String(l.id) === String(logId));
    if (!log) return null;
    Object.assign(log, updates);
    this.save();
    return log;
  }

  hasSentTemplate(checkoutId, templateId) {
    const logs = this.data.emailLogs || [];
    return logs.some(l => 
      String(l.checkoutId) === String(checkoutId) && 
      Number(l.templateId) === Number(templateId) && 
      l.status === 'sent'
    );
  }

  getLastSentForCheckout(checkoutId) {
    const logs = this.data.emailLogs || [];
    return logs.find(l => String(l.checkoutId) === String(checkoutId) && l.status === 'sent');
  }

  getAllSentForCheckout(checkoutId) {
    const logs = this.data.emailLogs || [];
    return logs.filter(l => String(l.checkoutId) === String(checkoutId) && l.status === 'sent');
  }

  isSuppressed(email) {
    if (!email) return true;
    const suppressions = this.data.suppressions || [];
    return suppressions.includes(email.toLowerCase().trim());
  }

  addSuppression(email) {
    if (!email) return;
    if (!this.data.suppressions) this.data.suppressions = [];
    const em = email.toLowerCase().trim();
    if (!this.data.suppressions.includes(em)) {
      this.data.suppressions.push(em);
      this.save();
    }
  }

  getCustomerSequence(checkoutId) {
    if (!this.data.customerSequences) this.data.customerSequences = {};
    return this.data.customerSequences[String(checkoutId)] || null;
  }

  getAllCustomerSequences() {
    if (!this.data.customerSequences) this.data.customerSequences = {};
    return this.data.customerSequences;
  }

  startCustomerSequence(checkoutId, customerEmail = '') {
    if (!this.data.customerSequences) this.data.customerSequences = {};
    const existing = this.data.customerSequences[String(checkoutId)];
    const now = new Date().toISOString();
    this.data.customerSequences[String(checkoutId)] = {
      checkoutId: String(checkoutId),
      email: customerEmail,
      active: true,
      startedAt: existing?.startedAt || now,
      resumedAt: now
    };
    this.save();
    return this.data.customerSequences[String(checkoutId)];
  }

  stopCustomerSequence(checkoutId) {
    if (!this.data.customerSequences) this.data.customerSequences = {};
    if (this.data.customerSequences[String(checkoutId)]) {
      this.data.customerSequences[String(checkoutId)].active = false;
      this.data.customerSequences[String(checkoutId)].stoppedAt = new Date().toISOString();
      this.save();
      return this.data.customerSequences[String(checkoutId)];
    }
    return null;
  }
}

module.exports = new Database();
