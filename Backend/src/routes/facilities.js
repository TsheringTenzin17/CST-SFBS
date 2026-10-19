// =============================================================
// Backend/src/routes/facilities.js
// =============================================================
// GET /facilities                        list every active court/ground
// GET /facilities/summary?date=          real slot counts per facility (Home + Facilities cards)
// GET /facilities/:id/availability?date= rules + bookings + maintenance for one day
const express = require('express');
const pool = require('../db');
const { bhutanNow, toMin, dayOfWeek, isValidDate } = require('../time');
const router = express.Router();

// ---------- 1. list ----------
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, type, group_name, court_label, capacity, location, max_duration_minutes
       FROM facilities WHERE is_active = true ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

// ---------- 2. summary (real numbers instead of hardcoded badges) ----------
// For the given date, counts how many bookable slots each facility has and
// how many are still free. A slot is NOT free if it is: already booked,
// in the past (today only), or inside a maintenance block. Slots whose rule
// is "maintenance / college team" are not counted at all.
router.get('/summary', async (req, res) => {
  try {
    const now = bhutanNow();
    const date = req.query.date || now.date;
    if (!isValidDate(date)) return res.status(400).json({ error: 'date must look like 2026-10-20' });
    const dow = dayOfWeek(date);

    const [facilities, rules, bookings, blocks] = await Promise.all([
      pool.query('SELECT id, name, group_name, max_duration_minutes FROM facilities WHERE is_active = true ORDER BY id'),
      pool.query(
        `SELECT facility_id, to_char(start_time,'HH24:MI') AS start_time,
                to_char(end_time,'HH24:MI') AS end_time, primary_role
         FROM schedule_rules WHERE day_of_week = $1`, [dow]),
      pool.query(
        `SELECT facility_id, to_char(start_time,'HH24:MI') AS start_time,
                to_char(end_time,'HH24:MI') AS end_time
         FROM bookings WHERE booking_date = $1 AND status <> 'cancelled'`, [date]),
      pool.query(
        `SELECT facility_id FROM maintenance_blocks
         WHERE $1::date BETWEEN start_date AND end_date`, [date]),
    ]);

    const blockedIds = new Set(blocks.rows.map((b) => b.facility_id));

    const summary = facilities.rows.map((f) => {
      const slotMin = f.max_duration_minutes || 120; // courts: 1 hour, football: 2 hours
      const booked = bookings.rows.filter((b) => b.facility_id === f.id);
      const bookable = rules.rows.filter((r) => r.facility_id === f.id && r.primary_role !== 'maintenance');

      let total = 0;
      let available = 0;
      for (const r of bookable) {
        for (let s = toMin(r.start_time); s + slotMin <= toMin(r.end_time); s += slotMin) {
          const e = s + slotMin;
          total += 1;
          const taken = booked.some((b) => toMin(b.start_time) < e && toMin(b.end_time) > s);
          const past = date < now.date || (date === now.date && s <= now.minutes);
          if (!taken && !past && !blockedIds.has(f.id)) available += 1;
        }
      }
      return { facility_id: f.id, name: f.name, group_name: f.group_name, total, available, blocked: blockedIds.has(f.id) };
    });

    res.json({ date, facilities: summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build availability summary' });
  }
});

// ---------- 3. availability for one facility on one day ----------
router.get('/:id/availability', async (req, res) => {
  const id = Number(req.params.id);
  const date = req.query.date;
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid facility id' });
  if (!date || !isValidDate(date)) return res.status(400).json({ error: 'date query param is required, e.g. ?date=2026-10-20' });

  try {
    const dow = dayOfWeek(date);
    const [rules, bookings, maintenance] = await Promise.all([
      pool.query(
        `SELECT to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time,
                primary_role, fallback_role, fallback_type, notes
         FROM schedule_rules WHERE facility_id = $1 AND day_of_week = $2 ORDER BY start_time`, [id, dow]),
      pool.query(
        `SELECT to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time, status
         FROM bookings WHERE facility_id = $1 AND booking_date = $2 AND status <> 'cancelled'
         ORDER BY start_time`, [id, date]),
      pool.query(
        `SELECT reason FROM maintenance_blocks
         WHERE facility_id = $1 AND $2::date BETWEEN start_date AND end_date`, [id, date]),
    ]);

    res.json({
      facility_id: id,
      date,
      day_of_week: dow,
      rules: rules.rows,
      existing_bookings: bookings.rows,
      maintenance: maintenance.rows, // non-empty = facility closed that day
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

module.exports = router;