// =============================================================
// Backend/src/routes/admin.js
// admin routes for support requests, users and reports
// =============================================================
// GET   /admin/support-requests                         list support requests
// PATCH /admin/support-requests/:id                     change status of a request
// POST  /admin/support-requests/:id/notify-resolution   email the user that it is resolved
// GET   /admin/users                                    list accounts
// GET   /admin/users/:id                                one account + its booking summary
// PATCH /admin/users/:id                                edit details, role, active/suspended
// PATCH /admin/users/:id/role                           change an account's role
// GET   /admin/reports                                  numbers for the Reports tab
// every route checks that the signed-in user is an admin

// =============================================================
// IMPORTS AND SETUP
// =============================================================

const express = require('express');               // express makes the routes
const pool = require('../db');                    // database connection
const { requireAdmin } = require('../auth');      // middleware, allows admins only
const { bhutanNow } = require('../time');         // gives the current Bhutan date and time
const { sendEmail } = require('../email');        // sends emails
const router = express.Router();                  // new router for this file

// =============================================================
// CONSTANTS
// =============================================================

const ROLES = ['student', 'faculty', 'outsider', 'admin'];                  // all roles an account can have
const SUPPORT_STATUSES = ['pending_review', 'in_progress', 'resolved'];     // all statuses of a support request

// =============================================================
// SUPPORT REQUESTS
// =============================================================

// ---- get the list of support requests -------------------------
router.get('/support-requests', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(                                   // run the query
      `SELECT id, user_id, name, email, message, status,               -- request details
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at -- nice date format
       FROM support_requests                                           -- read from this table
       ORDER BY created_at DESC, id DESC                               -- newest first
       LIMIT 250`,                                                     // only the latest 250
    );
    res.json(result.rows);                                             // send the rows back
  } catch (err) {
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to fetch support requests' });   // tell the client it failed
  }
});

// ---- change the status of one support request -----------------
router.patch('/support-requests/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;                                         // new status from the request body
  if (!SUPPORT_STATUSES.includes(status)) {                            // status must be an allowed one
    return res.status(400).json({ error: `status must be one of: ${SUPPORT_STATUSES.join(', ')}` });   // stop and send error
  }
  try {
    const result = await pool.query(                                   // $1 is the new status, $2 is the request id
      `WITH old_request AS (
         SELECT id, status FROM support_requests WHERE id = $2 FOR UPDATE   -- lock the old row
       ),
       updated AS (
         UPDATE support_requests request SET status = $1                    -- set the new status
         FROM old_request
         WHERE request.id = old_request.id
         RETURNING request.id, request.user_id, request.name, request.email,
                   request.message, request.status, request.created_at,
                   old_request.status AS previous_status                    -- keep the old status too
       )
       SELECT id, user_id, name, email, message, status, previous_status,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at       -- nice date format
       FROM updated`,
      [status, req.params.id],                                         // values for $1 and $2
    );
    if (result.rows.length === 0)                                      // no row updated, request does not exist
      return res.status(404).json({ error: 'Support request not found' });   // stop and send 404
    const { previous_status, ...request } = result.rows[0];            // remove previous_status from the data
    res.json({ request });                                             // send the updated request back
  } catch (err) {
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to update support request' });   // tell the client it failed
  }
});

// ---- email the user when the request is resolved --------------
router.post('/support-requests/:id/notify-resolution', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(                                   // get the request details
      `SELECT id, name, email, status FROM support_requests WHERE id = $1`,
      [req.params.id],                                                 // $1 is the request id
    );
    if (result.rows.length === 0)                                      // request not found
      return res.status(404).json({ error: 'Support request not found' });   // stop and send 404
    const request = result.rows[0];                                    // take the first row
    if (request.status !== 'resolved') {                               // it must be resolved first
      return res
        .status(400)
        .json({ error: 'Mark the support request resolved before sending an update' });   // stop and send error
    }
    await sendEmail({                                                  // send the email
      to: request.email,                                               // the person who made the request
      subject: 'Your CST-SFBS support request was resolved',           // email title
      text: `Hello ${request.name},\n\nYour support request #${request.id} has been marked resolved by the DSA office.\n\nIf you still need help, reply to this email or contact the office directly.`,   // email body
    });
    res.json({ message: 'Resolution update email sent' });             // tell the client the email was sent
  } catch (err) {
    console.error(err);                                                // show the error in the server console
    res.status(503).json({                                             // 503 because the email service may be down
      error:
        'Could not send the resolution email. Check the email service configuration and try again.',
    });
  }
});

// =============================================================
// USERS
// =============================================================

// ---- get the list of all users --------------------------------
router.get('/users', requireAdmin, async (req, res) => {
  try {
    // password_hash is NOT selected on purpose, so it is never sent out
    const result = await pool.query(                                   // run the query
      `SELECT id, full_name, email, role, student_staff_id, contact_number, is_active,   -- user details
              to_char(created_at, 'YYYY-MM-DD') AS joined              -- join date
       FROM users ORDER BY id`,                                        // all users, ordered by id
    );
    res.json(result.rows);                                             // send the rows back
  } catch (err) {
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to fetch users' });          // tell the client it failed
  }
});

// ---- get one account, used by the "User Account Detail" page --
router.get('/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);                                    // change the id from text to a number
  if (!Number.isSafeInteger(id) || id <= 0)                            // id must be a positive whole number
    return res.status(400).json({ error: 'Invalid user id' });         // stop and send error
  try {
    const found = await pool.query(                                    // get the user details
      `SELECT id, full_name, email, role, student_staff_id, contact_number, is_active,   -- user details
              to_char(created_at, 'YYYY-MM-DD') AS joined              -- join date
       FROM users WHERE id = $1`,                                      // only this user
      [id],                                                            // $1 is the user id
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'User not found' });   // user does not exist

    // completed = approved and already finished
    // upcoming = still live and not finished yet (Bhutan time)
    const now = bhutanNow();                                           // current Bhutan date and time
    const nowTime = `${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`;   // minutes of the day to HH:MM, like "09:05"

    const [summary, recent] = await Promise.all([                      // run both queries at the same time
      pool.query(                                                      // count this user's bookings
        `SELECT COUNT(*)::int AS total,                                -- all bookings
                COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,   -- cancelled bookings
                COUNT(*) FILTER (WHERE status = 'approved'             -- approved and already over
                  AND (booking_date < $2::date OR (booking_date = $2::date AND end_time <= $3::time)))::int AS completed,
                COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'expired')   -- live and not over yet
                  AND (booking_date > $2::date OR (booking_date = $2::date AND end_time > $3::time)))::int AS upcoming
         FROM bookings WHERE user_id = $1`,                            // only this user
        [id, now.date, nowTime],                                       // $1 user id, $2 today, $3 time now
      ),
      pool.query(                                                      // get the latest 10 bookings
        `SELECT b.id, b.status, f.name AS facility_name,               -- booking and facility name
                to_char(b.booking_date, 'YYYY-MM-DD') AS booking_date, -- nice date format
                to_char(b.start_time, 'HH24:MI') AS start_time,        -- start time
                to_char(b.end_time, 'HH24:MI') AS end_time,            -- end time
                (b.status = 'approved' AND (b.booking_date < $2::date  -- true if approved and already over
                  OR (b.booking_date = $2::date AND b.end_time <= $3::time))) AS is_completed
         FROM bookings b JOIN facilities f ON f.id = b.facility_id     -- join to get the facility name
         WHERE b.user_id = $1                                          -- only this user
         ORDER BY b.booking_date DESC, b.start_time DESC LIMIT 10`,    // newest first, max 10
        [id, now.date, nowTime],                                       // $1 user id, $2 today, $3 time now
      ),
    ]);
    res.json({ user: found.rows[0], summary: summary.rows[0], bookings: recent.rows });   // send everything together
  } catch (err) {
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to fetch user' });           // tell the client it failed
  }
});

// ---- edit an account, admin can send any of the fields --------
router.patch('/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);                                    // change the id from text to a number
  if (!Number.isSafeInteger(id) || id <= 0)                            // id must be a positive whole number
    return res.status(400).json({ error: 'Invalid user id' });         // stop and send error
  const { full_name, email, contact_number, student_staff_id, role, is_active } = req.body;   // all possible fields

  const sets = [];                                                     // SQL parts, like "full_name = $1"
  const values = [];                                                   // values for $1, $2, $3 ...
  const add = (column, value) => {                                     // helper to add one column to the update
    values.push(value);                                                // save the value
    sets.push(`${column} = $${values.length}`);                        // save the SQL part with its position
  };

  // ---- full name ----
  if (full_name !== undefined) {                                       // only if it was sent
    if (typeof full_name !== 'string' || !full_name.trim() || full_name.trim().length > 120) {   // text, not empty, 120 max
      return res.status(400).json({ error: 'Full name is required (120 characters max)' });     // stop and send error
    }
    add('full_name', full_name.trim());                                // add the cleaned name
  }

  // ---- email ----
  if (email !== undefined) {                                           // only if it was sent
    const clean = typeof email === 'string' ? email.trim().toLowerCase() : '';   // remove spaces, make lowercase
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 150) {       // must look like an email, 150 max
      return res.status(400).json({ error: 'Enter a valid email address' });     // stop and send error
    }
    add('email', clean);                                               // add the cleaned email
  }

  // ---- contact number ----
  if (contact_number !== undefined) {                                  // only if it was sent
    const clean = String(contact_number ?? '').trim();                 // change to text, remove spaces
    if (clean.length > 30) return res.status(400).json({ error: 'Contact number is too long' });   // 30 max
    add('contact_number', clean || null);                              // save null if empty
  }

  // ---- student / staff id ----
  if (student_staff_id !== undefined) {                                // only if it was sent
    const clean = String(student_staff_id ?? '').trim();               // change to text, remove spaces
    if (clean.length > 50) return res.status(400).json({ error: 'Student / staff ID is too long' });   // 50 max
    add('student_staff_id', clean || null);                            // save null if empty
  }

  // ---- role ----
  if (role !== undefined) {                                            // only if it was sent
    if (!ROLES.includes(role))                                         // must be an allowed role
      return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });   // stop and send error
    if (id === req.user.id && role !== 'admin') {                      // admin cannot remove own admin role
      return res
        .status(400)
        .json({ error: 'You cannot remove your own admin role (you would lock yourself out)' });   // stop and send error
    }
    add('role', role);                                                 // add the role
  }

  // ---- active / suspended ----
  if (is_active !== undefined) {                                       // only if it was sent
    if (typeof is_active !== 'boolean')                                // must be true or false
      return res.status(400).json({ error: 'is_active must be true or false' });   // stop and send error
    if (id === req.user.id && !is_active) {                            // admin cannot suspend own account
      return res.status(400).json({ error: 'You cannot suspend your own account' });   // stop and send error
    }
    add('is_active', is_active);                                       // add is_active
  }

  if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });   // no field was sent

  try {
    values.push(id);                                                   // user id goes last, used in WHERE
    const result = await pool.query(                                   // update only the fields that were sent
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}
       RETURNING id, full_name, email, role, student_staff_id, contact_number, is_active,   -- send the new data back
                 to_char(created_at, 'YYYY-MM-DD') AS joined`,        // join date
      values,                                                          // all the values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });   // user does not exist
    res.json({ user: result.rows[0] });                                // send the updated user back
  } catch (err) {
    if (err.code === '23505')                                          // 23505 = email already used
      return res.status(409).json({ error: 'That email is already used by another account' });   // stop and send 409
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to update user' });          // tell the client it failed
  }
});

// ---- change only the role of an account -----------------------
// this is also how a NEW admin is made from the website:
// an existing admin promotes an account that has already registered
router.patch('/users/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;                                           // new role from the request body
  if (!ROLES.includes(role))                                           // must be an allowed role
    return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });   // stop and send error
  try {
    if (Number(req.params.id) === req.user.id && role !== 'admin') {   // admin cannot remove own admin role
      return res
        .status(400)
        .json({ error: 'You cannot remove your own admin role (you would lock yourself out)' });   // stop and send error
    }
    const result = await pool.query(                                   // run the query
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role',   // change the role, return the user
      [role, req.params.id],                                           // $1 is the role, $2 is the user id
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });   // user does not exist
    res.json({ user: result.rows[0] });                                // send the updated user back
  } catch (err) {
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to change role' });          // tell the client it failed
  }
});

// =============================================================
// REPORTS
// =============================================================

// make the dates used by the reports (all are Bhutan dates)
// "active users" and "utilization" look at the last 30 days
function reportWindows() {
  const today = bhutanNow().date;                                      // today's date in Bhutan
  const shift = (dateStr, days) => {                                   // helper to move a date by some days
    const d = new Date(`${dateStr}T00:00:00Z`);                        // make a date from the text
    d.setUTCDate(d.getUTCDate() + days);                               // add the days
    return d.toISOString().slice(0, 10);                               // back to YYYY-MM-DD text
  };
  const monthStart = `${today.slice(0, 8)}01`;                         // first day of this month
  const [y, m] = today.split('-').map(Number);                         // year and month as numbers
  const pad = (n) => String(n).padStart(2, '0');                       // make two digits, 5 -> "05"
  const nextMonthStart = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;   // first day of next month
  const prevMonthStart = m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`;    // first day of last month
  return { today, monthStart, nextMonthStart, prevMonthStart, thirtyDaysAgo: shift(today, -29) };   // -29 so today is counted too
}

// ---- get all the numbers for the Reports tab ------------------
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const w = reportWindows();                                         // get the dates we need
    const [totals, byFacility, byRole, users, month, active, hours, activity] = await Promise.all([   // run all queries at the same time

      // 1. total, confirmed and cancelled bookings
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'expired'))::int AS confirmed,
                COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
         FROM bookings`,
      ),

      // 2. live bookings for each facility group
      pool.query(
        `SELECT f.group_name AS name, COUNT(*)::int AS bookings
         FROM bookings b JOIN facilities f ON f.id = b.facility_id
         WHERE b.status NOT IN ('cancelled', 'expired') GROUP BY f.group_name ORDER BY bookings DESC`,
      ),

      // 3. live bookings for each user role
      pool.query(
        `SELECT u.role, COUNT(*)::int AS bookings
         FROM bookings b JOIN users u ON u.id = b.user_id
         WHERE b.status NOT IN ('cancelled', 'expired') GROUP BY u.role ORDER BY bookings DESC`,
      ),

      // 4. total number of users
      pool.query('SELECT COUNT(*)::int AS n FROM users'),

      // 5. this month vs last month, counted by booking date
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE booking_date >= $1 AND booking_date < $2)::int AS this_total,
                COUNT(*) FILTER (WHERE booking_date >= $1 AND booking_date < $2 AND status = 'cancelled')::int AS this_cancelled,
                COUNT(*) FILTER (WHERE booking_date >= $3 AND booking_date < $1)::int AS last_total
         FROM bookings`,
        [w.monthStart, w.nextMonthStart, w.prevMonthStart],            // $1 this month, $2 next month, $3 last month
      ),

      // 6. people who had at least one live booking in the last 30 days
      pool.query(
        `SELECT COUNT(DISTINCT user_id)::int AS n FROM bookings
         WHERE status NOT IN ('cancelled', 'expired') AND booking_date BETWEEN $1 AND $2`,
        [w.thirtyDaysAgo, w.today],                                    // $1 start, $2 end
      ),

      // 7. booked hours vs open hours (standard weekly schedule) in the last 30 days
      pool.query(
        `WITH days AS (
           SELECT d::date AS day FROM generate_series($1::date, $2::date, interval '1 day') AS d   -- every day in the range
         ), open_h AS (
           SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600), 0) AS hours   -- total open hours
           FROM days
           JOIN schedule_rules r ON r.day_of_week = EXTRACT(DOW FROM days.day)::int
           JOIN facilities f ON f.id = r.facility_id AND f.is_active IS NOT FALSE
           WHERE r.timetable IN ('all', 'standard')
         ), booked AS (
           SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0) AS hours       -- total booked hours
           FROM bookings
           WHERE status NOT IN ('cancelled', 'expired') AND booking_date BETWEEN $1 AND $2
         )
         SELECT open_h.hours::float AS open_hours, booked.hours::float AS booked_hours FROM open_h, booked`,
        [w.thirtyDaysAgo, w.today],                                    // $1 start, $2 end
      ),

      // 8. latest 5 events that have a date: new bookings and new maintenance blocks
      pool.query(
        `SELECT * FROM (
           SELECT (b.created_at AT TIME ZONE 'UTC') AS happened_at, u.full_name AS user_name, u.role AS user_role,
                  'Booked Slot' AS action, f.group_name AS facility, b.status AS status   -- booking events
           FROM bookings b
           JOIN users u ON u.id = b.user_id
           JOIN facilities f ON f.id = b.facility_id
           UNION ALL
           SELECT (m.created_at AT TIME ZONE 'UTC'), COALESCE(u.full_name, 'Admin'), COALESCE(u.role, 'admin'),
                  'Maintenance Block', f.group_name,                                      -- maintenance events
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
        [w.today],                                                     // $1 is today
      ),
    ]);

    res.json({                                                         // send all the numbers together
      totals: totals.rows[0],                                          // total, confirmed, cancelled
      by_facility: byFacility.rows,                                    // bookings per facility group
      by_role: byRole.rows,                                            // bookings per role
      total_users: users.rows[0].n,                                    // number of users
      month: month.rows[0],                                            // this month vs last month
      active_users: active.rows[0].n,                                  // active users in 30 days
      hours: hours.rows[0],                                            // open hours and booked hours
      recent_activity: activity.rows,                                  // latest 5 events
    });
  } catch (err) {
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to build report' });         // tell the client it failed
  }
});

module.exports = router;                                               // share the router so the main app can use it
