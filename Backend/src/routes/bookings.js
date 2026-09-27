const express = require('express');
const pool = require('../db');
const router = express.Router();

function isRoleEligible(userRole, ruleRole) {
  if (ruleRole === 'any') return userRole === 'student' || userRole === 'outsider';
  if (ruleRole === 'student') return userRole === 'student';
  if (ruleRole === 'commercial') return userRole === 'outsider';
  if (['faculty_male', 'faculty_female', 'faculty'].includes(ruleRole)) return userRole === 'faculty';
  if (ruleRole === 'maintenance') return false;
  return false;
}

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
    if (!eligible && rule.fallback_role && rule.fallback_type === 'manual_release') {
      eligible = isRoleEligible(userRole, rule.fallback_role);
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

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, admin_user_id, rejection_reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
  if (!admin_user_id) return res.status(400).json({ error: 'admin_user_id is required' });

  try {
    const adminCheck = await pool.query('SELECT role FROM users WHERE id = $1', [admin_user_id]);
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only an admin can approve or reject bookings' });
    }
    const result = await pool.query(
      `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING id, status, user_id, facility_id, booking_date, start_time, end_time`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });

    const booking = result.rows[0];
    const message = status === 'approved'
      ? `Your booking for ${booking.booking_date} (${booking.start_time}-${booking.end_time}) was approved.`
      : `Your booking for ${booking.booking_date} (${booking.start_time}-${booking.end_time}) was rejected.${rejection_reason ? ' Reason: ' + rejection_reason : ''}`;
    await pool.query(`INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)`,
      [booking.user_id, status === 'approved' ? 'booking_approved' : 'booking_rejected', message]);

    res.json({ booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

router.patch('/:id/release', async (req, res) => {
  const { id } = req.params;
  const { admin_user_id } = req.body;
  if (!admin_user_id) return res.status(400).json({ error: 'admin_user_id is required' });
  try {
    const adminCheck = await pool.query('SELECT role FROM users WHERE id = $1', [admin_user_id]);
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only an admin can release a slot' });
    }
    const result = await pool.query(
      `UPDATE bookings SET released_for_commercial = true WHERE id = $1 RETURNING id, released_for_commercial`, [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to release slot' });
  }
});

module.exports = router;