const nodemailer = require('nodemailer');

const RESEND_API_URL = 'https://api.resend.com/emails';

let gmailTransporter = null;

function getGmailTransporter() {
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
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

async function sendWithResend({ to, subject, text }) {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.RESEND_FROM, to: [to], subject, text }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider rejected the message (${response.status}): ${detail}`);
  }
}

async function sendEmail({ to, subject, text }) {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return sendWithGmail({ to, subject, text });
  }
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    return sendWithResend({ to, subject, text });
  }
  throw new Error(
    'Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD (or RESEND_API_KEY and RESEND_FROM).'
  );
}

module.exports = { sendEmail };