const express = require('express');
const pool = require('../db');
const router = express.Router();

// Create the route: when someone visits GET /bookings, run this function
// async lets us wait for the database. req = incoming request, res = our reply
router.get('/', async (req, res) => {
  try {
    // Ask the database for data (pool is the database connection)
    const result = await pool.query(
      // Pick these columns from the bookings table (nicknamed b)
      `SELECT b.id, b.status, b.booking_date, b.start_time, b.end_time, b.purpose,
              u.full_name AS user_name, u.role AS user_role,   -- the person's name and role from users (u)
              f.name AS facility_name                           -- the facility's name from facilities (f)
       FROM bookings b
       JOIN users u ON u.id = b.user_id                         -- link each booking to the user who made it
       JOIN facilities f ON f.id = b.facility_id                -- link each booking to its facility
       ORDER BY b.booking_date DESC, b.start_time DESC`         // newest bookings first
    );
    res.json(result.rows);                                      // send the rows back as JSON
  } catch (err) {
    console.error(err);                                         // print the error in the backend terminal
    res.status(500).json({ error: 'Failed to fetch bookings' }); // tell the frontend something went wrong
  }
});

function isRoleEligible(userRole, ruleRole) {
  if (ruleRole === 'any') return userRole === 'student' || userRole === 'outsider';
  if (ruleRole === 'student') return userRole === 'student';
  if (ruleRole === 'commercial') return userRole === 'outsider';
  if (['faculty_male', 'faculty_female', 'faculty'].includes(ruleRole)) return userRole === 'faculty';
  if (ruleRole === 'maintenance') return false;
  return false;
}

// Returns true if the given slot starts within the next hour (and hasn't
// already passed). Used for fallback_type = 'auto_release' rules, e.g.
// Wed 6-8pm football: Female Faculty has first claim, and it auto-opens
// to Commercial 1hr before kickoff if nobody's booked it yet — no admin
// action required, which keeps the whole system genuinely real-time.
//
// NOTE: assumes the server's system clock is in the same timezone as
// booking_date/start_time (Bhutan Time). Fine for a single-server pilot;
// revisit if you ever deploy across timezones.
function isWithinAutoReleaseWindow(bookingDate, startTime) {
  const slotStart = new Date(`${bookingDate}T${startTime}`);
  const now = new Date();
  const msUntilSlot = slotStart.getTime() - now.getTime();
  const oneHourMs = 60 * 60 * 1000;
  return msUntilSlot <= oneHourMs && msUntilSlot >= 0;
}

// POST /bookings — always auto-confirms immediately, no admin approval step
router.post('/', async (req, res) => {
  const { user_id, facility_id, booking_date, start_time, end_time, purpose } = req.body;
  if (!user_id || !facility_id || !booking_date || !start_time || !end_time) {
    return res.status(400).json({ error: 'user_id, facility_id, booking_date, start_time, end_time are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const userRole = userResult.rows[0].role;

    const dayOfWeek = new Date(booking_date).getDay();
    const ruleResult = await client.query(
      `SELECT primary_role, fallback_role, fallback_type FROM schedule_rules
       WHERE facility_id = $1 AND day_of_week = $2 AND start_time <= $3 AND end_time >= $4`,
      [facility_id, dayOfWeek, start_time, end_time]
    );
    if (ruleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No booking rule covers this facility/day/time' });
    }

    const rule = ruleResult.rows[0];
    let eligible = isRoleEligible(userRole, rule.primary_role);

    if (!eligible && rule.fallback_role && rule.fallback_type === 'auto_release') {
      const windowOpen = isWithinAutoReleaseWindow(booking_date, start_time);
      eligible = windowOpen && isRoleEligible(userRole, rule.fallback_role);
      if (!eligible && windowOpen === false && isRoleEligible(userRole, rule.fallback_role)) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: `This slot is reserved for ${rule.primary_role} until 1 hour before start time. Try again closer to the slot.`,
        });
      }
    }

    if (userRole === 'admin') eligible = true;
    if (!eligible) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: `Role '${userRole}' is not eligible for this slot (${rule.primary_role})` });
    }

    const insertResult = await client.query(
      `INSERT INTO bookings (user_id, facility_id, booking_date, start_time, end_time, purpose, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'approved') RETURNING id, status`,
      [user_id, facility_id, booking_date, start_time, end_time, purpose || null]
    );

    await client.query(
      `INSERT INTO notifications (user_id, type, message) VALUES ($1, 'booking_confirmed', $2)`,
      [user_id, `Your booking for ${booking_date} (${start_time}-${end_time}) is confirmed.`]
    );

    await client.query('COMMIT');
    res.status(201).json({ booking: insertResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This slot was just booked by someone else. Please choose another.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// PATCH /bookings/:id — admin cancel/override for exceptions (no-shows,
// disputes, policy violations reported after the fact). This is NOT part
// of the normal booking flow anymore — every booking above auto-confirms.
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, admin_user_id, reason } = req.body;
  if (!['approved', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: "status must be 'approved' or 'cancelled'" });
  }
  if (!admin_user_id) return res.status(400).json({ error: 'admin_user_id is required' });

  try {
    const adminCheck = await pool.query('SELECT role FROM users WHERE id = $1', [admin_user_id]);
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only an admin can override a booking' });
    }
    const result = await pool.query(
      `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING id, status, user_id, facility_id, booking_date, start_time, end_time`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });

    const booking = result.rows[0];
    if (status === 'cancelled') {
      const message = `Your booking for ${booking.booking_date} (${booking.start_time}-${booking.end_time}) was cancelled by an admin.${reason ? ' Reason: ' + reason : ''}`;
      await pool.query(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'booking_cancelled', $2)`, [booking.user_id, message]);
    }

    res.json({ booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

module.exports = router;