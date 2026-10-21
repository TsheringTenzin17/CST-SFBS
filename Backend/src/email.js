const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error('Email is not configured. Set RESEND_API_KEY and RESEND_FROM.');
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider rejected the message (${response.status}): ${detail}`);
  }
}

module.exports = { sendEmail };
