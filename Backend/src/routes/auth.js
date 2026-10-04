const express = require('express');
const pool = require('../db');
const router = express.Router();

// POST /auth/register
// NOTE: password_hash is stored as plain text for now — this is NOT
// production-safe. Before the pilot, replace with bcrypt hashing
// (npm install bcrypt; bcrypt.hash(password, 10) on register,
// bcrypt.compare on login).
router.post('/register', async (req, res) => {
  const { full_name, email, student_staff_id, role, password, contact_number } = req.body;
  if (!full_name || !email || !role || !password) {
    return res.status(400).json({ error: 'full_name, email, role, and password are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO users (full_name, email, student_staff_id, role, password_hash, contact_number)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, full_name, email, role`,
      [full_name, email, student_staff_id || null, role, password, contact_number || null]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const result = await pool.query('SELECT id, full_name, email, role, password_hash FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0 || result.rows[0].password_hash !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { password_hash, ...user } = result.rows[0];
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;