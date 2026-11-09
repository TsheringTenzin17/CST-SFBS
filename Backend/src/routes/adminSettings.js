// =============================================================
// Backend/src/routes/adminSettings.js  —  "System Settings" admin page
// =============================================================
// GET /admin/settings    every facility with its schedule_rules (the allocation
//                        policy the booking API enforces), plus a few live
//                        system numbers. Read-only: rules change through the
//                        SQL files or through the editable schedule endpoints below.
const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../auth');
const { bhutanNow } = require('../time');
const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const today = bhutanNow().date;
    const [facilities, rules, users, tournament, blocks] = await Promise.all([
      pool.query(
        `SELECT id, name, type, group_name, court_label, max_duration_minutes, is_active
         FROM facilities ORDER BY id`),
      pool.query(
        `SELECT id, facility_id, day_of_week,
                to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time,
                primary_role, fallback_role, fallback_type, timetable, day_booking_cap
         FROM schedule_rules ORDER BY facility_id, day_of_week, start_time`),
      pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role <> 'admin'`),
      pool.query(
        `SELECT name, to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date
         FROM tournament_periods WHERE $1::date BETWEEN start_date AND end_date
         ORDER BY start_date LIMIT 1`, [today]),
      pool.query(
        `SELECT COUNT(DISTINCT facility_id)::int AS n FROM maintenance_blocks
         WHERE $1::date BETWEEN start_date AND end_date`, [today]),
    ]);

    res.json({
      today,
      facilities: facilities.rows,
      rules: rules.rows,
      info: {
        registered_users: users.rows[0].n,
        open_facilities: facilities.rows.filter((f) => f.is_active).length,
        total_facilities: facilities.rows.length,
        facilities_in_maintenance: blocks.rows[0].n,
        active_tournament: tournament.rows[0] || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load system settings' });
  }
});

const VALID_ROLES = ['maintenance', 'student', 'student_female', 'faculty', 'faculty_male', 'faculty_female', 'commercial', 'any', 'everyone'];
const VALID_TIMETABLES = ['all', 'standard', 'tournament'];

function scheduleBody(body) {
  const facilityId = Number(body.facility_id);
  const day = Number(body.day_of_week);
  const start = String(body.start_time || '');
  const end = String(body.end_time || '');
  const role = String(body.primary_role || '');
  const timetable = VALID_TIMETABLES.includes(body.timetable) ? body.timetable : 'all';
  const fallbackRole = body.fallback_role ? String(body.fallback_role) : null;
  const fallbackType = ['auto_release', 'day_start_release', 'weekly_release'].includes(body.fallback_type) ? body.fallback_type : 'none';
  if (!Number.isInteger(facilityId) || facilityId < 1) return { error: 'Choose a valid facility.' };
  if (!Number.isInteger(day) || day < 0 || day > 6) return { error: 'Choose a valid day.' };
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(end)) {
    return { error: 'Enter valid start and end times.' };
  }
  if (end <= start) return { error: 'End time must be later than start time.' };
  if (!VALID_ROLES.includes(role)) return { error: 'Choose a valid booking role.' };
  const cap = body.day_booking_cap === '' || body.day_booking_cap == null ? null : Number(body.day_booking_cap);
  if (cap !== null && (!Number.isInteger(cap) || cap < 1)) return { error: 'Daily booking limit must be a positive whole number.' };
  return { value: { facilityId, day, start: start.slice(0, 5), end: end.slice(0, 5), role, timetable, fallbackRole, fallbackType, cap } };
}

async function overlapExists(client, value, excludeId = 0) {
  const result = await client.query(
    `SELECT 1 FROM schedule_rules
     WHERE facility_id = $1 AND day_of_week = $2
      AND (timetable = 'all' OR $3 = 'all' OR timetable = $3) AND id <> $6
       AND start_time < $5::time AND end_time > $4::time LIMIT 1`,
    [value.facilityId, value.day, value.timetable, value.start, value.end, excludeId]
  );
  return result.rows.length > 0;
}

router.post('/rules', requireAdmin, async (req, res) => {
  const checked = scheduleBody(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const value = checked.value;
  const client = await pool.connect();
  try {
    if (await overlapExists(client, value)) return res.status(409).json({ error: 'This time overlaps another rule for the same day.' });
    const saved = await client.query(
      `INSERT INTO schedule_rules
       (facility_id, day_of_week, start_time, end_time, primary_role, fallback_role, fallback_type, timetable, day_booking_cap, notes)
       VALUES ($1,$2,$3::time,$4::time,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [value.facilityId, value.day, value.start, value.end, value.role, value.fallbackRole, value.fallbackType, value.timetable, value.cap, String(req.body.notes || '').trim() || null]
    );
    res.status(201).json({ id: saved.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add schedule rule' });
  } finally {
    client.release();
  }
});

router.put('/rules/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid schedule rule.' });
  const checked = scheduleBody(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const value = checked.value;
  const client = await pool.connect();
  try {
    if (await overlapExists(client, value, id)) return res.status(409).json({ error: 'This time overlaps another rule for the same day.' });
    const updated = await client.query(
      `UPDATE schedule_rules SET facility_id=$1, day_of_week=$2, start_time=$3::time, end_time=$4::time,
       primary_role=$5, fallback_role=$6, fallback_type=$7, timetable=$8, day_booking_cap=$9, notes=$10
       WHERE id=$11 RETURNING id`,
      [value.facilityId, value.day, value.start, value.end, value.role, value.fallbackRole, value.fallbackType, value.timetable, value.cap, String(req.body.notes || '').trim() || null, id]
    );
    if (!updated.rows.length) return res.status(404).json({ error: 'Schedule rule not found.' });
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update schedule rule' });
  } finally {
    client.release();
  }
});

router.delete('/rules/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid schedule rule.' });
  try {
    const deleted = await pool.query('DELETE FROM schedule_rules WHERE id=$1 RETURNING id', [id]);
    if (!deleted.rows.length) return res.status(404).json({ error: 'Schedule rule not found.' });
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete schedule rule' });
  }
});

module.exports = router;
