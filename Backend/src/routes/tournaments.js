// =============================================================
// Backend/src/routes/tournaments.js  —  department tournament periods
// =============================================================
// GET    /tournaments        list periods                  (anyone can read)
// POST   /tournaments        add a period                  (admin only)
// DELETE /tournaments/:id    remove a period               (admin only)
// A date inside a period uses the football "tournament" timetable
// (students play 8-10 PM, etc.); every other date uses "standard".
const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../auth');
const { isValidDate } = require('../time');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date, 'YYYY-MM-DD') AS end_date
       FROM tournament_periods ORDER BY start_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tournament periods' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, start_date, end_date } = req.body;
  if (!isValidDate(start_date) || !isValidDate(end_date)) {
    return res.status(400).json({ error: 'start_date and end_date (YYYY-MM-DD) are required' });
  }
  if (end_date < start_date) return res.status(400).json({ error: 'End date cannot be before start date' });
  if (name != null && (typeof name !== 'string' || name.trim().length > 120)) {
    return res.status(400).json({ error: 'Name must be 120 characters or fewer' });
  }
  try {
    const inserted = await pool.query(
      `INSERT INTO tournament_periods (name, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [typeof name === 'string' && name.trim() ? name.trim() : null, start_date, end_date, req.user.id]
    );
    res.status(201).json({ id: inserted.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add tournament period' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await pool.query('DELETE FROM tournament_periods WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tournament period not found' });
    res.json({ deleted: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete tournament period' });
  }
});

module.exports = router;
