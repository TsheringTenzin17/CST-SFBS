const nodemailer = require('nodemailer');

const RESEND_API_URL = 'https://api.resend.com/emails';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_TIMEOUT_MS = 15000;

let gmailTransporter = null;

function getGmailTransporter() {
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: EMAIL_TIMEOUT_MS,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return gmailTransporter;
}

async function sendWithGmail({ to, subject, text }) {
  await getGmailTransporter().sendMail({
    from: `"CST-SFBS" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
  });
}

async function postJson(url, headers, body, providerName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${providerName} rejected the message (${response.status}): ${detail}`);
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${providerName} request timed out.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sendWithResend({ to, subject, text }) {
  return postJson(
    RESEND_API_URL,
    { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    { from: process.env.RESEND_FROM, to: [to], subject, text },
    'Resend'
  );
}

function sendWithBrevo({ to, subject, text }) {
  return postJson(
    BREVO_API_URL,
    { 'api-key': process.env.BREVO_API_KEY },
    {
      sender: { name: 'CST-SFBS', email: process.env.BREVO_SENDER },
      to: [{ email: to }],
      subject,
      textContent: text,
    },
    'Brevo'
  );
}

async function sendEmail({ to, subject, text }) {
  if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER) {
    return sendWithBrevo({ to, subject, text });
  }
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    return sendWithResend({ to, subject, text });
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return sendWithGmail({ to, subject, text });
  }
  throw new Error(
    'Email is not configured. Set BREVO_API_KEY and BREVO_SENDER (or RESEND_API_KEY and RESEND_FROM, or GMAIL_USER and GMAIL_APP_PASSWORD).'
  );
}

module.exports = { sendEmail };