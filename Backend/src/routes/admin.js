// =============================================================
// Backend/src/routes/admin.js  —  users + reports for the admin dashboard
// =============================================================
// GET   /admin/users                            list accounts
// PATCH /admin/users/:id/role                   change an account's role
// GET   /admin/reports                          numbers for the Reports tab
// Every route checks the signed-in user's current database role.
const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../auth');
const { sendEmail } = require('../email');
const router = express.Router();

const ROLES = ['student', 'faculty', 'outsider', 'admin'];
const SUPPORT_STATUSES = ['pending_review', 'in_progress', 'resolved'];

router.get('/support-requests', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, name, email, message, status,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
       FROM support_requests
       ORDER BY created_at DESC, id DESC
       LIMIT 250`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

router.patch('/support-requests/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!SUPPORT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${SUPPORT_STATUSES.join(', ')}` });
  }
  try {
    const result = await pool.query(
      `WITH old_request AS (
         SELECT id, status FROM support_requests WHERE id = $2 FOR UPDATE
       ),
       updated AS (
         UPDATE support_requests request SET status = $1
         FROM old_request
         WHERE request.id = old_request.id
         RETURNING request.id, request.user_id, request.name, request.email,
                   request.message, request.status, request.created_at,
                   old_request.status AS previous_status
       )
       SELECT id, user_id, name, email, message, status, previous_status,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
       FROM updated`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Support request not found' });
    const { previous_status, ...request } = result.rows[0];
    res.json({ request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update support request' });
  }
});

router.post('/support-requests/:id/notify-resolution', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, status FROM support_requests WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Support request not found' });
    const request = result.rows[0];
    if (request.status !== 'resolved') {
      return res.status(400).json({ error: 'Mark the support request resolved before sending an update' });
    }
    await sendEmail({
      to: request.email,
      subject: 'Your CST-SFBS support request was resolved',
      text: `Hello ${request.name},\n\nYour support request #${request.id} has been marked resolved by the DSA office.\n\nIf you still need help, reply to this email or contact the office directly.`,
    });
    res.json({ message: 'Resolution update email sent' });
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: 'Could not send the resolution email. Check the email service configuration and try again.' });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    // password_hash is deliberately NOT selected.
    const result = await pool.query(
      `SELECT id, full_name, email, role, student_staff_id, contact_number,
              to_char(created_at, 'YYYY-MM-DD') AS joined
       FROM users ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// This is also how a NEW admin is created from the website: an existing
// admin promotes an account that has already registered.
router.patch('/users/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
  try {
    if (Number(req.params.id) === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role (you would lock yourself out)' });
    }
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role',
      [role, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change role' });
  }
});

router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const [totals, byFacility, byRole, users] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS confirmed,
                COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
         FROM bookings`),
      pool.query(
        `SELECT f.group_name AS name, COUNT(*)::int AS bookings
         FROM bookings b JOIN facilities f ON f.id = b.facility_id
         WHERE b.status <> 'cancelled' GROUP BY f.group_name ORDER BY bookings DESC`),
      pool.query(
        `SELECT u.role, COUNT(*)::int AS bookings
         FROM bookings b JOIN users u ON u.id = b.user_id
         WHERE b.status <> 'cancelled' GROUP BY u.role ORDER BY bookings DESC`),
      pool.query('SELECT COUNT(*)::int AS n FROM users'),
    ]);

    res.json({
      totals: totals.rows[0],
      by_facility: byFacility.rows,
      by_role: byRole.rows,
      total_users: users.rows[0].n,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build report' });
  }
});

module.exports = router;