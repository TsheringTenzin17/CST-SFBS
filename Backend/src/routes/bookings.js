// =============================================================
// Backend/src/routes/bookings.js  —  EVERYTHING about bookings
// =============================================================
// POST   /bookings                  make a booking (instant confirmation)
// GET    /bookings/user/:userId     one user's own bookings        (My Bookings page)
// PATCH  /bookings/:id/cancel       a user cancels their own booking
// GET    /bookings                  all bookings                   (admin only)
// PATCH  /bookings/:id              admin cancels any booking, with a reason
// PATCH  /bookings/:id/reschedule   admin moves a booking          (admin only)
//
// Layout of this file:
//   A. helpers      B. validateSlot (rules shared by book + reschedule)
//   C. routes
const express = require('express');
const pool = require('../db');
const { authenticate, requireAdmin } = require('../auth');
const { bhutanNow, toMin, hhmm, dayOfWeek, isValidDate, isValidTime } = require('../time');
const router = express.Router();

async function addBookingNotification(queryable, userId, type, message) {
  const preferences = await queryable.query(
    'SELECT booking_updates FROM user_notification_preferences WHERE user_id = $1',
    [userId]
  );
  // Missing preference rows use the enabled-by-default behavior from the settings API.
  if (preferences.rows[0]?.booking_updates === false) return;
  await queryable.query(
    'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)',
    [userId, type, message]
  );
}

// ---------------------------------------------------------------
// A. HELPERS
// ---------------------------------------------------------------

// Which user roles may book a slot whose rule says `ruleRole`?
// 'any' = students and outsiders; 'everyone' also includes faculty/staff.
function isRoleEligible(userRole, ruleRole) {
  if (ruleRole === 'everyone') return ['student', 'faculty', 'outsider'].includes(userRole);
  if (ruleRole === 'any') return userRole === 'student' || userRole === 'outsider';
  if (ruleRole === 'student') return userRole === 'student';
  if (ruleRole === 'commercial') return userRole === 'outsider';
  if (['faculty', 'faculty_male', 'faculty_female'].includes(ruleRole)) return userRole === 'faculty';
  return false; // 'maintenance' and anything unknown
}

// Auto-release rule (Wed 6-8pm football): faculty have first claim, and the
// slot opens to commercial users 1 hour before it starts. Uses BHUTAN time.
function isWithinAutoReleaseWindow(bookingDate, startTime) {
  const now = bhutanNow();
  if (bookingDate !== now.date) return false;
  const minutesUntil = toMin(startTime) - now.minutes;
  return minutesUntil >= 0 && minutesUntil <= 60;
}

// Decide whether `userRole` may book the slot covered by `rule`.
// Returns { ok: true } or { ok: false, status, message }.
function checkEligibility(userRole, rule, bookingDate, startTime) {
  if (userRole === 'admin') return { ok: true };

  if (rule.primary_role === 'maintenance') {
    return { ok: false, status: 403, message: 'This slot is reserved for maintenance / college team practice.' };
  }
  if (isRoleEligible(userRole, rule.primary_role)) return { ok: true };

  if (rule.fallback_role && rule.fallback_type === 'auto_release' && isRoleEligible(userRole, rule.fallback_role)) {
    if (isWithinAutoReleaseWindow(bookingDate, startTime)) return { ok: true };
    return {
      ok: false,
      status: 403,
      message: 'This slot is reserved for faculty until 1 hour before it starts. Please try again closer to the time.',
    };
  }
  return { ok: false, status: 403, message: `Role '${userRole}' is not eligible for this slot (${rule.primary_role}).` };
}

const CONFLICT_MESSAGE = 'This slot was just booked by someone else. Please choose another.';

// ---------------------------------------------------------------
// B. validateSlot — the rules that apply to ANY booking or move
// ---------------------------------------------------------------
// Checks, in order: facility exists + is open, length limit, a schedule rule
// covers the time, no maintenance block, no overlapping booking.
// Must be called INSIDE a transaction that already holds the facility lock.
// `excludeBookingId` lets a reschedule ignore the booking being moved.
async function validateSlot(client, { facilityId, date, start, end, excludeBookingId = 0 }) {
  const fac = await client.query('SELECT max_duration_minutes, is_active FROM facilities WHERE id = $1', [facilityId]);
  if (fac.rows.length === 0) return { ok: false, status: 404, message: 'Facility not found' };
  if (!fac.rows[0].is_active) return { ok: false, status: 400, message: 'This facility is not open for booking' };

  const length = toMin(end) - toMin(start);
  const maxMin = fac.rows[0].max_duration_minutes;
  if (maxMin && length > maxMin) {
    return { ok: false, status: 400, message: `Bookings for this facility are limited to ${maxMin} minutes` };
  }

  const ruleResult = await client.query(
    `SELECT primary_role, fallback_role, fallback_type FROM schedule_rules
     WHERE facility_id = $1 AND day_of_week = $2
       AND start_time <= $3::time AND end_time >= $4::time
     ORDER BY start_time LIMIT 1`,
    [facilityId, dayOfWeek(date), start, end]
  );
  if (ruleResult.rows.length === 0) {
    return { ok: false, status: 400, message: 'No booking rule covers this facility/day/time. Pick a slot shown on the availability page.' };
  }

  const block = await client.query(
    `SELECT reason FROM maintenance_blocks
     WHERE facility_id = $1 AND $2::date BETWEEN start_date AND end_date LIMIT 1`,
    [facilityId, date]
  );
  if (block.rows.length > 0) {
    const why = block.rows[0].reason ? `: ${block.rows[0].reason}` : '';
    return { ok: false, status: 400, message: `This facility is closed for maintenance on that date${why}` };
  }

  const overlap = await client.query(
    `SELECT 1 FROM bookings
     WHERE facility_id = $1 AND booking_date = $2 AND status <> 'cancelled'
       AND id <> $5 AND start_time < $4::time AND end_time > $3::time LIMIT 1`,
    [facilityId, date, start, end, excludeBookingId]
  );
  if (overlap.rows.length > 0) return { ok: false, status: 409, message: CONFLICT_MESSAGE };

  return { ok: true, rule: ruleResult.rows[0] };
}

// Shared input checks. Returns an error message, or null when the input is fine.
function checkSlotInput(date, start, end) {
  if (!isValidDate(date) || !isValidTime(start) || !isValidTime(end)) return 'Invalid date or time format';
  if (toMin(end) <= toMin(start)) return 'End time must be after start time';
  const now = bhutanNow();
  if (date < now.date || (date === now.date && toMin(start) <= now.minutes)) return 'That time has already passed';
  return null;
}

// ---------------------------------------------------------------
// C. ROUTES
// ---------------------------------------------------------------

// ---- POST /bookings : make a booking -------------------------------------
router.post('/', async (req, res) => {
  const { user_id, facility_id, booking_date, purpose } = req.body;
  if (!user_id || !facility_id || !booking_date || !req.body.start_time || !req.body.end_time) {
    return res.status(400).json({ error: 'user_id, facility_id, booking_date, start_time and end_time are required' });
  }
  const start = hhmm(req.body.start_time);
  const end = hhmm(req.body.end_time);
  const inputError = checkSlotInput(booking_date, start, end);
  if (inputError) return res.status(400).json({ error: inputError });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // One booking at a time PER FACILITY. The second of two simultaneous
    // requests waits here, then sees the first booking and gets a 409.
    // This is what guarantees zero double bookings (Objective O3).
    await client.query('SELECT pg_advisory_xact_lock(1001, $1::int)', [facility_id]);

    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const userRole = userResult.rows[0].role;

    const slot = await validateSlot(client, { facilityId: facility_id, date: booking_date, start, end });
    if (!slot.ok) {
      await client.query('ROLLBACK');
      return res.status(slot.status).json({ error: slot.message });
    }

    const eligibility = checkEligibility(userRole, slot.rule, booking_date, start);
    if (!eligibility.ok) {
      await client.query('ROLLBACK');
      return res.status(eligibility.status).json({ error: eligibility.message });
    }

    // Confirmed instantly — there is no admin approval step.
    const inserted = await client.query(
      `INSERT INTO bookings (user_id, facility_id, booking_date, start_time, end_time, purpose, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'approved') RETURNING id, status`,
      [user_id, facility_id, booking_date, start, end, purpose || null]
    );
    await addBookingNotification(
      client,
      user_id,
      'booking_confirmed',
      `Your booking for ${booking_date} (${start}-${end}) is confirmed.`
    );

    await client.query('COMMIT');
    res.status(201).json({ booking: inserted.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: CONFLICT_MESSAGE }); // database backstop
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// ---- GET /bookings/user/:userId : "My Bookings" --------------------------
router.get('/user/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });
  try {
    const result = await pool.query(
      `SELECT b.id, b.status, b.purpose, b.facility_id,
              to_char(b.booking_date, 'YYYY-MM-DD') AS booking_date,
              to_char(b.start_time, 'HH24:MI') AS start_time,
              to_char(b.end_time, 'HH24:MI') AS end_time,
              f.name AS facility_name
       FROM bookings b JOIN facilities f ON f.id = b.facility_id
       WHERE b.user_id = $1
       ORDER BY b.booking_date DESC, b.start_time DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch your bookings' });
  }
});

// ---- PATCH /bookings/:id/cancel : a user cancels their OWN booking -------
router.patch('/:id/cancel', authenticate, async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({ error: 'Invalid booking id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'approved'
       RETURNING id, user_id, status,
                 to_char(booking_date, 'YYYY-MM-DD') AS booking_date,
                 to_char(start_time, 'HH24:MI') AS start_time,
                 to_char(end_time, 'HH24:MI') AS end_time`,
      [bookingId, req.user.id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found, not yours, or already cancelled' });
    }

    const booking = result.rows[0];
    await addBookingNotification(
      client,
      booking.user_id,
      'booking_cancelled',
      `Your booking for ${booking.booking_date} (${booking.start_time}-${booking.end_time}) was cancelled.`
    );

    await client.query('COMMIT');
    res.json({ booking: { id: booking.id, status: booking.status } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  } finally {
    client.release();
  }
});

// ---- GET /bookings : every booking (admin) -------------------------------
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.status, b.purpose,
              to_char(b.booking_date, 'YYYY-MM-DD') AS booking_date,
              to_char(b.start_time, 'HH24:MI') AS start_time,
              to_char(b.end_time, 'HH24:MI') AS end_time,
              u.full_name AS user_name, u.role AS user_role, f.name AS facility_name
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN facilities f ON f.id = b.facility_id
       ORDER BY b.booking_date DESC, b.start_time DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ---- PATCH /bookings/:id : admin cancels any booking ---------------------
// Exception handling only (no-shows, rule violations, closures).
router.patch('/:id', requireAdmin, async (req, res) => {
  const { status, reason } = req.body;
  if (status !== 'cancelled') return res.status(400).json({ error: "Only status 'cancelled' is supported" });
  if (typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'A cancellation reason is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status <> 'cancelled'
       RETURNING id, user_id, to_char(booking_date,'YYYY-MM-DD') AS booking_date,
                 to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }

    const b = result.rows[0];
    await addBookingNotification(
      client,
      b.user_id,
      'booking_cancelled',
      `Your booking for ${b.booking_date} (${b.start_time}-${b.end_time}) was cancelled by an admin. Reason: ${reason.trim()}`
    );
    await client.query('COMMIT');
    res.json({ booking: { id: b.id, status: 'cancelled' } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  } finally {
    client.release();
  }
});

// ---- PATCH /bookings/:id/reschedule-request : owner moves own booking ----
router.patch('/:id/reschedule-request', authenticate, async (req, res) => {
  const { booking_date, reason } = req.body;
  if (!booking_date || !req.body.start_time || !req.body.end_time) {
    return res.status(400).json({ error: 'booking_date, start_time and end_time are required' });
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'A reason for rescheduling is required' });
  }
  if (reason.trim().length > 500) {
    return res.status(400).json({ error: 'The rescheduling reason must be 500 characters or fewer' });
  }
  const start = hhmm(req.body.start_time);
  const end = hhmm(req.body.end_time);
  const inputError = checkSlotInput(booking_date, start, end);
  if (inputError) return res.status(400).json({ error: inputError });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, user_id, facility_id FROM bookings
       WHERE id = $1 AND user_id = $2 AND status = 'approved' FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Upcoming confirmed booking not found' });
    }
    const booking = existing.rows[0];

    await client.query('SELECT pg_advisory_xact_lock(1001, $1::int)', [booking.facility_id]);

    const slot = await validateSlot(client, {
      facilityId: booking.facility_id, date: booking_date, start, end, excludeBookingId: booking.id,
    });
    if (!slot.ok) {
      await client.query('ROLLBACK');
      return res.status(slot.status).json({ error: slot.message });
    }

    const eligibility = checkEligibility(req.user.role, slot.rule, booking_date, start);
    if (!eligibility.ok) {
      await client.query('ROLLBACK');
      return res.status(eligibility.status).json({ error: eligibility.message });
    }

    await client.query(
      'UPDATE bookings SET booking_date = $1, start_time = $2, end_time = $3 WHERE id = $4',
      [booking_date, start, end, booking.id]
    );
    await addBookingNotification(
      client,
      booking.user_id,
      'booking_rescheduled',
      `Your booking was rescheduled to ${booking_date} (${start}-${end}). Reason: ${reason.trim()}`
    );
    await client.query('COMMIT');
    res.json({ booking: { id: booking.id, booking_date, start_time: start, end_time: end } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: CONFLICT_MESSAGE });
    console.error(err);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  } finally {
    client.release();
  }
});

// ---- PATCH /bookings/:id/reschedule : admin moves any booking -------------
// Same safety rules as a new booking (rule exists, not maintenance, no
// overlap, length limit) — an admin can move a booking but cannot create a
// double booking.
router.patch('/:id/reschedule', requireAdmin, async (req, res) => {
  const { booking_date } = req.body;
  if (!booking_date || !req.body.start_time || !req.body.end_time) {
    return res.status(400).json({ error: 'booking_date, start_time and end_time are required' });
  }
  const start = hhmm(req.body.start_time);
  const end = hhmm(req.body.end_time);
  const inputError = checkSlotInput(booking_date, start, end);
  if (inputError) return res.status(400).json({ error: inputError });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, user_id, facility_id FROM bookings WHERE id = $1 AND status <> 'cancelled' FOR UPDATE`,
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }
    const booking = existing.rows[0];

    await client.query('SELECT pg_advisory_xact_lock(1001, $1::int)', [booking.facility_id]);

    const slot = await validateSlot(client, {
      facilityId: booking.facility_id, date: booking_date, start, end, excludeBookingId: booking.id,
    });
    if (!slot.ok) {
      await client.query('ROLLBACK');
      return res.status(slot.status).json({ error: slot.message });
    }
    if (slot.rule.primary_role === 'maintenance') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'That time is reserved for maintenance / college team practice' });
    }

    await client.query(
      'UPDATE bookings SET booking_date = $1, start_time = $2, end_time = $3 WHERE id = $4',
      [booking_date, start, end, booking.id]
    );
    await addBookingNotification(
      client,
      booking.user_id,
      'booking_rescheduled',
      `Your booking was moved by an admin to ${booking_date} (${start}-${end}).`
    );
    await client.query('COMMIT');
    res.json({ booking: { id: booking.id, booking_date, start_time: start, end_time: end } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: CONFLICT_MESSAGE });
    console.error(err);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  } finally {
    client.release();
  }
});

module.exports = router;