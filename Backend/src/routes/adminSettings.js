// =============================================================
// Backend/src/routes/adminSettings.js  —  "System Settings" admin page
// =============================================================
// GET /admin/settings    every facility with its schedule_rules (the allocation
//                        policy the booking API enforces), plus a few live
//                        system numbers. Read-only: rules change through the
//                        SQL files in src/db/ and the Tournaments page.
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
        `SELECT facility_id, day_of_week,
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

module.exports = router;
