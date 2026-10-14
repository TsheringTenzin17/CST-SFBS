const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /facilities - list all active facilities
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, type, group_name, court_label, capacity, location, max_duration_minutes FROM facilities WHERE is_active = true ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

// GET /facilities/:id - single facility (used by the details page)
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, type, group_name, court_label, capacity, location, max_duration_minutes
       FROM facilities WHERE id = $1 AND is_active = true`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch facility' });
  }
});

// GET /facilities/:id/availability?date=YYYY-MM-DD
router.get('/:id/availability', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param is required, e.g. ?date=2026-10-05' });

  try {
    const dayOfWeek = new Date(date).getDay();
    const rulesResult = await pool.query(
      `SELECT start_time, end_time, primary_role, fallback_role, fallback_type, notes
       FROM schedule_rules WHERE facility_id = $1 AND day_of_week = $2 ORDER BY start_time`,
      [id, dayOfWeek]
    );
    const bookingsResult = await pool.query(
      `SELECT start_time, end_time, status, released_for_commercial
       FROM bookings WHERE facility_id = $1 AND booking_date = $2 AND status IN ('pending','approved') ORDER BY start_time`,
      [id, date]
    );
    res.json({ facility_id: Number(id), date, day_of_week: dayOfWeek, rules: rulesResult.rows, existing_bookings: bookingsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

module.exports = router;
