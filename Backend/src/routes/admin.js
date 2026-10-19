// =============================================================
// Backend/src/routes/admin.js  —  users + reports for the admin dashboard
// =============================================================
// GET   /admin/users?admin_user_id=             list accounts
// PATCH /admin/users/:id/role                   change an account's role
// GET   /admin/reports?admin_user_id=           numbers for the Reports tab
// Every route checks that the caller is an admin.
const express = require('express');
const pool = require('../db');
const { isAdmin } = require('../adminCheck');
const router = express.Router();

const ROLES = ['student', 'faculty', 'outsider', 'admin'];

router.get('/users', async (req, res) => {
  try {
    if (!(await isAdmin(req.query.admin_user_id))) return res.status(403).json({ error: 'Admins only' });
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
router.patch('/users/:id/role', async (req, res) => {
  const { admin_user_id, role } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
  try {
    if (!(await isAdmin(admin_user_id))) return res.status(403).json({ error: 'Admins only' });
    if (Number(req.params.id) === Number(admin_user_id) && role !== 'admin') {
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

router.get('/reports', async (req, res) => {
  try {
    if (!(await isAdmin(req.query.admin_user_id))) return res.status(403).json({ error: 'Admins only' });

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