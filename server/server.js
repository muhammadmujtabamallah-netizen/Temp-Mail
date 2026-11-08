'use strict';
/**
 * 2Sec Mail — self-hosted temporary email server.
 *
 * What it does:
 *  - Receives real email over SMTP (port 25) for YOUR domain.
 *  - REST API compatible with the 2Sec Mail website:
 *      GET  /api/v1/mailbox/new?domain=        -> create a random mailbox
 *      GET  /api/v1/mailbox/:address/messages  -> list messages
 *      GET  /api/v1/mailbox/:address/messages/:id -> read one message
 *      GET  /api/v1/domains                   -> list domains
 *  - Serves the web inbox (public/index.html) on the HTTP port.
 *
 * Setup: copy .env.example to .env, set MAIL_DOMAIN to a domain you own
 * whose MX record points at this server, then: npm install && npm start
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');

// ---- config (env vars, with defaults) ----
const MAIL_DOMAIN = (process.env.MAIL_DOMAIN || 'example.com').toLowerCase();
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000', 10);
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);

// ---- tiny .env loader (no dependency) ----
(function loadEnv() {
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
})();

// Re-read config after .env (env file wins over defaults above if set before start)
const DOMAIN = (process.env.MAIL_DOMAIN || MAIL_DOMAIN).toLowerCase();
const HTTP = parseInt(process.env.HTTP_PORT || String(HTTP_PORT), 10);
const SMTP = parseInt(process.env.SMTP_PORT || String(SMTP_PORT), 10);

// ---- in-memory store: address -> { address, box, domain, createdAt, messages: [] } ----
const boxes = new Map();
let nextId = 1;

const ADJ = ['smart', 'bright', 'swift', 'happy', 'brave', 'calm', 'cool', 'fast', 'golden', 'silver', 'mighty', 'gentle', 'lucky', 'super', 'mega', 'royal', 'magic', 'cosmic', 'solar', 'lunar'];
const ANIMAL = ['lion', 'tiger', 'panda', 'eagle', 'falcon', 'wolf', 'bear', 'fox', 'hawk', 'shark', 'cobra', 'python', 'turtle', 'rabbit', 'monkey', 'dragon', 'phoenix', 'falcon', 'cheetah', 'jaguar'];
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomBox() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const b = ANIMAL[Math.floor(Math.random() * ANIMAL.length)];
  let r = '';
  for (let i = 0; i < 6; i++) r += CHARS[Math.floor(Math.random() * CHARS.length)];
  return `${a}-${b}-${r}`;
}

function findOtpCode(text) {
  if (!text) return null;
  const m = String(text).match(/\b(\d{4,8})\b/);
  return m ? m[1] : null;
}

function getOrCreateBox(address) {
  const addr = String(address).toLowerCase();
  if (!boxes.has(addr)) {
    const [box, domain] = addr.split('@');
    boxes.set(addr, { address: addr, box: box || addr, domain: domain || DOMAIN, createdAt: Date.now(), messages: [] });
  }
  return boxes.get(addr);
}

function publicMessage(m) {
  return {
    id: m.id,
    from: m.from,
    subject: m.subject,
    date: m.date,
    preview: (m.text || '').slice(0, 200),
    otp_code: m.otp_code || null,
  };
}

// ---- SMTP server: receive mail for our domain ----
const smtp = new SMTPServer({
  disabledCommands: ['AUTH'],
  onConnect(session, cb) { cb(); },
  onMailFrom(address, session, cb) { cb(); },
  onRcptTo(address, session, cb) {
    const rcpt = String(address.address || '').toLowerCase();
    if (!rcpt.endsWith('@' + DOMAIN)) {
      return cb(new Error('550 Relay not allowed for ' + rcpt));
    }
    cb();
  },
  onData(stream, session, cb) {
    simpleParser(stream)
      .then((parsed) => {
        const rcpt = (session.envelope.rcptTo[0] || {}).address || '';
        const box = getOrCreateBox(rcpt);
        const text = parsed.text || '';
        const html = parsed.html || '';
        const msg = {
          id: nextId++,
          from: parsed.from ? parsed.from.text : '',
          subject: parsed.subject || '(no subject)',
          date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
          text,
          html,
          otp_code: findOtpCode((parsed.subject || '') + ' ' + text),
        };
        box.messages.unshift(msg);
        console.log(`[mail] ${rcpt} <- ${msg.from} :: ${msg.subject}`);
        cb();
      })
      .catch((err) => {
        console.error('[mail] parse error:', err.message);
        cb(err);
      });
  },
});

smtp.on('error', (err) => console.error('[smtp] error:', err.message));

// ---- REST API + static site ----
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/v1/mailbox/new', (req, res) => {
  const box = randomBox();
  const address = `${box}@${DOMAIN}`;
  getOrCreateBox(address);
  res.json({ success: true, address, box, domain: DOMAIN, available_domains: [DOMAIN], expires_in_days: 7, expires_in_hours: 168 });
});

app.get('/api/v1/domains', (req, res) => {
  res.json({ success: true, domains: [DOMAIN], primary: DOMAIN, featured: DOMAIN, auto_delete_days: 7 });
});

app.get('/api/v1/mailbox/:address/messages', (req, res) => {
  const box = getOrCreateBox(req.params.address);
  const list = box.messages.map(publicMessage);
  res.json({ success: true, address: box.address, count: list.length, messages: list, stats: { total: list.length, unread: list.length } });
});

app.get('/api/v1/mailbox/:address/messages/:id', (req, res) => {
  const box = getOrCreateBox(req.params.address);
  const msg = box.messages.find((m) => String(m.id) === String(req.params.id));
  if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });
  res.json({ success: true, message: { id: msg.id, from: msg.from, subject: msg.subject, date: msg.date, text: msg.text, html: msg.html, otp_code: msg.otp_code } });
});

// Web inbox (public/index.html uses relative API base /api/v1/)
app.use(express.static(path.join(__dirname, 'public')));

// ---- cleanup: drop messages/boxes older than 7 days, hourly ----
setInterval(() => {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [addr, box] of boxes) {
    box.messages = box.messages.filter((m) => new Date(m.date).getTime() > cutoff);
    if (box.messages.length === 0 && box.createdAt < cutoff) boxes.delete(addr);
  }
}, 60 * 60 * 1000);

// ---- start ----
smtp.listen(SMTP, () => console.log(`[smtp] listening on port ${SMTP} for @${DOMAIN}`));
app.listen(HTTP, () => {
  console.log(`[http] 2Sec Mail running at http://localhost:${HTTP}/`);
  console.log(`[http] domain: ${DOMAIN} — point your MX record at this server`);
});
