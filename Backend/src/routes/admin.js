// =============================================================
// Backend/src/routes/admin.js  —  users + reports for the admin dashboard
// =============================================================
// GET   /admin/users                            list accounts
// GET   /admin/users/:id                        one account + its booking summary
// PATCH /admin/users/:id                        edit details, role, active/suspended
// PATCH /admin/users/:id/role                   change an account's role
// GET   /admin/reports                          numbers for the Reports tab
// Every route checks the signed-in user's current database role.
const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../auth');
const { bhutanNow } = require('../time');
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
      `SELECT id, full_name, email, role, student_staff_id, contact_number, is_active,
              to_char(created_at, 'YYYY-MM-DD') AS joined
       FROM users ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ---- one account, for the "User Account Detail" page ----------------------
router.get('/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid user id' });
  try {
    const found = await pool.query(
      `SELECT id, full_name, email, role, student_staff_id, contact_number, is_active,
              to_char(created_at, 'YYYY-MM-DD') AS joined
       FROM users WHERE id = $1`,
      [id]
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // "Completed" = confirmed and already over; "upcoming" = live and not started/finished yet (Bhutan time).
    const now = bhutanNow();
    const nowTime = `${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`;
    const [summary, recent] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                COUNT(*) FILTER (WHERE status = 'approved'
                  AND (booking_date < $2::date OR (booking_date = $2::date AND end_time <= $3::time)))::int AS completed,
                COUNT(*) FILTER (WHERE status <> 'cancelled'
                  AND (booking_date > $2::date OR (booking_date = $2::date AND end_time > $3::time)))::int AS upcoming
         FROM bookings WHERE user_id = $1`,
        [id, now.date, nowTime]
      ),
      pool.query(
        `SELECT b.id, b.status, f.name AS facility_name,
                to_char(b.booking_date, 'YYYY-MM-DD') AS booking_date,
                to_char(b.start_time, 'HH24:MI') AS start_time,
                to_char(b.end_time, 'HH24:MI') AS end_time,
                (b.status = 'approved' AND (b.booking_date < $2::date
                  OR (b.booking_date = $2::date AND b.end_time <= $3::time))) AS is_completed
         FROM bookings b JOIN facilities f ON f.id = b.facility_id
         WHERE b.user_id = $1
         ORDER BY b.booking_date DESC, b.start_time DESC LIMIT 10`,
        [id, now.date, nowTime]
      ),
    ]);
    res.json({ user: found.rows[0], summary: summary.rows[0], bookings: recent.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ---- edit an account: any subset of the fields below ---------------------
router.patch('/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid user id' });
  const { full_name, email, contact_number, student_staff_id, role, is_active } = req.body;

  const sets = [];
  const values = [];
  const add = (column, value) => { values.push(value); sets.push(`${column} = $${values.length}`); };

  if (full_name !== undefined) {
    if (typeof full_name !== 'string' || !full_name.trim() || full_name.trim().length > 120) {
      return res.status(400).json({ error: 'Full name is required (120 characters max)' });
    }
    add('full_name', full_name.trim());
  }
  if (email !== undefined) {
    const clean = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 150) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    add('email', clean);
  }
  if (contact_number !== undefined) {
    const clean = String(contact_number ?? '').trim();
    if (clean.length > 30) return res.status(400).json({ error: 'Contact number is too long' });
    add('contact_number', clean || null);
  }
  if (student_staff_id !== undefined) {
    const clean = String(student_staff_id ?? '').trim();
    if (clean.length > 50) return res.status(400).json({ error: 'Student / staff ID is too long' });
    add('student_staff_id', clean || null);
  }
  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
    if (id === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role (you would lock yourself out)' });
    }
    add('role', role);
  }
  if (is_active !== undefined) {
    if (typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active must be true or false' });
    if (id === req.user.id && !is_active) {
      return res.status(400).json({ error: 'You cannot suspend your own account' });
    }
    add('is_active', is_active);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  try {
    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}
       RETURNING id, full_name, email, role, student_staff_id, contact_number, is_active,
                 to_char(created_at, 'YYYY-MM-DD') AS joined`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That email is already used by another account' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
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

// Dates are Bhutan dates. "Active users" and "utilization" look at the last 30 days.
function reportWindows() {
  const today = bhutanNow().date;
  const shift = (dateStr, days) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const monthStart = `${today.slice(0, 8)}01`;
  const [y, m] = today.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const nextMonthStart = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  const prevMonthStart = m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`;
  return { today, monthStart, nextMonthStart, prevMonthStart, thirtyDaysAgo: shift(today, -29) };
}

router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const w = reportWindows();
    const [totals, byFacility, byRole, users, month, active, hours, activity] = await Promise.all([
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
      // this month vs last month, by booking date
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE booking_date >= $1 AND booking_date < $2)::int AS this_total,
                COUNT(*) FILTER (WHERE booking_date >= $1 AND booking_date < $2 AND status = 'cancelled')::int AS this_cancelled,
                COUNT(*) FILTER (WHERE booking_date >= $3 AND booking_date < $1)::int AS last_total
         FROM bookings`,
        [w.monthStart, w.nextMonthStart, w.prevMonthStart]),
      // people who held at least one live booking in the last 30 days
      pool.query(
        `SELECT COUNT(DISTINCT user_id)::int AS n FROM bookings
         WHERE status <> 'cancelled' AND booking_date BETWEEN $1 AND $2`,
        [w.thirtyDaysAgo, w.today]),
      // booked hours vs. open hours (from the standard weekly schedule rules) over the same 30 days
      pool.query(
        `WITH days AS (
           SELECT d::date AS day FROM generate_series($1::date, $2::date, interval '1 day') AS d
         ), open_h AS (
           SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600), 0) AS hours
           FROM days
           JOIN schedule_rules r ON r.day_of_week = EXTRACT(DOW FROM days.day)::int
           JOIN facilities f ON f.id = r.facility_id AND f.is_active IS NOT FALSE
           WHERE r.timetable IN ('all', 'standard')
         ), booked AS (
           SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0) AS hours
           FROM bookings
           WHERE status <> 'cancelled' AND booking_date BETWEEN $1 AND $2
         )
         SELECT open_h.hours::float AS open_hours, booked.hours::float AS booked_hours FROM open_h, booked`,
        [w.thirtyDaysAgo, w.today]),
      // latest 5 events we can date: new bookings and new maintenance blocks
      pool.query(
        `SELECT * FROM (
           SELECT (b.created_at AT TIME ZONE 'UTC') AS happened_at, u.full_name AS user_name, u.role AS user_role,
                  'Booked Slot' AS action, f.group_name AS facility, b.status AS status
           FROM bookings b
           JOIN users u ON u.id = b.user_id
           JOIN facilities f ON f.id = b.facility_id
           UNION ALL
           SELECT (m.created_at AT TIME ZONE 'UTC'), COALESCE(u.full_name, 'Admin'), COALESCE(u.role, 'admin'),
                  'Maintenance Block', f.group_name,
                  CASE WHEN m.end_date < $1::date THEN 'ended'
                       WHEN m.start_date <= $1::date THEN 'active'
                       ELSE 'upcoming' END
           FROM maintenance_blocks m
           JOIN facilities f ON f.id = m.facility_id
           LEFT JOIN users u ON u.id = m.created_by
         ) e
         WHERE happened_at IS NOT NULL
         ORDER BY happened_at DESC
         LIMIT 5`,
        [w.today]),
    ]);

    res.json({
      totals: totals.rows[0],
      by_facility: byFacility.rows,
      by_role: byRole.rows,
      total_users: users.rows[0].n,
      month: month.rows[0],
      active_users: active.rows[0].n,
      hours: hours.rows[0],
      recent_activity: activity.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build report' });
  }
});

module.exports = router;