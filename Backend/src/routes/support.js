const express = require('express');
const pool = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Contact remains available to visitors, while valid sessions link requests to an account.
function optionalAuthenticate(req, res, next) {
  if (!req.get('authorization')) return next();
  return authenticate(req, res, next);
}

router.post('/requests', optionalAuthenticate, async (req, res) => {
  const { name, email, message } = req.body;
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanMessage = typeof message === 'string' ? message.trim() : '';

  if (!cleanName || cleanName.length > 120) {
    return res.status(400).json({ error: 'Name is required and must be 120 characters or fewer' });
  }
  if (!cleanEmail || cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)) {
    return res.status(400).json({ error: 'Enter a valid response email address' });
  }
  if (!cleanMessage || cleanMessage.length > 3000) {
    return res.status(400).json({ error: 'Message is required and must be 3000 characters or fewer' });
  }

  try {
    // Retain the user link when signed in, but never require an account to contact the office.
    const result = await pool.query(
      `INSERT INTO support_requests (user_id, name, email, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, to_char(created_at, 'YYYY') AS year`,
      [req.user?.id || null, cleanName, cleanEmail, cleanMessage]
    );
    const request = result.rows[0];
    res.status(201).json({
      ticket_id: `CST-${request.year}-${String(request.id).padStart(6, '0')}`,
      response_email: cleanEmail,
      status: 'pending_review',
    });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Could not save your support request' });
  }
});

module.exports = router;
