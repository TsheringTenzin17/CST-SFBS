// =============================================================
// Backend/src/routes/auth.js  —  register + login
// =============================================================
// POST /auth/register   POST /auth/login
// Passwords are hashed with bcrypt. Old plain-text passwords are upgraded
// to hashes the first time that user signs in.
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate, createSessionToken } = require('../auth');
const router = express.Router();

const COLLEGE_EMAIL = /^[^@\s]+\.cst@rub\.edu\.bt$/i;

// 02210145.cst@rub.edu.bt -> student ; kwangdi.cst@rub.edu.bt -> faculty (staff)
function roleFromCollegeEmail(email) {
  const local = email.split('.cst@')[0];
  return /^\d+$/.test(local) ? 'student' : 'faculty';
}

router.post('/register', async (req, res) => {
  const { full_name, student_staff_id, password, contact_number, role: requestedRole } = req.body;
  const email = (req.body.email || '').trim().toLowerCase();

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email and password are required' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  // The SERVER decides the role. Nobody can register as admin.
  let role;
  if (COLLEGE_EMAIL.test(email)) {
    role = roleFromCollegeEmail(email);
  } else {
    if (requestedRole === 'student' || requestedRole === 'faculty') {
      return res.status(400).json({ error: 'Student and staff accounts need a college email ending .cst@rub.edu.bt' });
    }
    role = 'outsider';
  }

  try {
    if (student_staff_id) {
      const taken = await pool.query('SELECT 1 FROM users WHERE student_staff_id = $1', [student_staff_id]);
      if (taken.rows.length > 0) return res.status(409).json({ error: 'An account with this Student / Staff ID already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, student_staff_id, role, password_hash, contact_number)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, full_name, email, role`,
      [full_name.trim(), email, student_staff_id || null, role, passwordHash, contact_number || null]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// The "email" field may contain an email OR a Student / Staff ID.
router.post('/login', async (req, res) => {
  const identifier = (req.body.email || req.body.identifier || '').trim();
  const { password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'email (or ID) and password are required' });

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, password_hash FROM users
       WHERE LOWER(email) = LOWER($1) OR student_staff_id = $1 LIMIT 1`,
      [identifier]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email/ID or password' });

    const row = result.rows[0];
    let ok;
    if (row.password_hash.startsWith('$2')) {
      ok = await bcrypt.compare(password, row.password_hash);
    } else {
      ok = row.password_hash === password; // old plain-text account
      if (ok) {
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(password, 10), row.id]);
      }
    }
    if (!ok) return res.status(401).json({ error: 'Invalid email/ID or password' });

    const { password_hash, ...user } = row;
    res.json({ user, token: createSessionToken(user.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;