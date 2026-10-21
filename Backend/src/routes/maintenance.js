// =============================================================
// Backend/src/routes/maintenance.js  —  closing a facility for repairs
// =============================================================
// GET    /maintenance                       list all blocks (anyone can read)
// POST   /maintenance                       add a block      (admin only)
// DELETE /maintenance/:id                  remove a block   (admin only)
// While a block covers a date, the booking API refuses that facility
// and the availability page shows "closed for maintenance".
const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../auth');
const { isValidDate } = require('../time');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.facility_id, f.name AS facility_name, m.reason,
              to_char(m.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(m.end_date, 'YYYY-MM-DD') AS end_date
       FROM maintenance_blocks m JOIN facilities f ON f.id = m.facility_id
       ORDER BY m.start_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch maintenance blocks' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { facility_id, start_date, end_date, reason } = req.body;
  if (!facility_id || !isValidDate(start_date) || !isValidDate(end_date)) {
    return res.status(400).json({ error: 'facility_id, start_date and end_date (YYYY-MM-DD) are required' });
  }
  if (end_date < start_date) return res.status(400).json({ error: 'End date cannot be before start date' });

  try {
    const inserted = await pool.query(
      `INSERT INTO maintenance_blocks (facility_id, start_date, end_date, reason, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [facility_id, start_date, end_date, reason || null, req.user.id]
    );
    // Tell the admin how many existing bookings are now affected so they can
    // cancel or reschedule them from the Bookings tab.
    const affected = await pool.query(
      `SELECT COUNT(*)::int AS n FROM bookings
       WHERE facility_id = $1 AND status <> 'cancelled' AND booking_date BETWEEN $2 AND $3`,
      [facility_id, start_date, end_date]
    );
    res.status(201).json({ id: inserted.rows[0].id, affected_bookings: affected.rows[0].n });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create maintenance block' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM maintenance_blocks WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove maintenance block' });
  }
});

module.exports = router;