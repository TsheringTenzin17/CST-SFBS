// =============================================================
// Backend/src/routes/adminSettings.js
// "System Settings" admin page
// =============================================================
// GET    /admin/settings         every facility with its schedule_rules (the allocation
//                                policy the booking API enforces), plus a few live
//                                system numbers. Read-only: rules change through the
//                                SQL files or through the editable schedule endpoints below.
// POST   /admin/settings/rules       add a schedule rule
// PUT    /admin/settings/rules/:id   edit a schedule rule
// DELETE /admin/settings/rules/:id   delete a schedule rule

// =============================================================
// IMPORTS AND SETUP
// =============================================================

const express = require('express');                                   // express makes the routes
const pool = require('../db');                                        // database connection
const { requireAdmin } = require('../auth');                          // middleware, allows admins only
const { bhutanNow } = require('../time');                             // gives the current Bhutan date and time
const router = express.Router();                                      // new router for this file

// =============================================================
// CONSTANTS
// =============================================================

const VALID_ROLES = [                                                 // all roles a schedule rule can use
  'maintenance',                                                      // facility is closed for maintenance
  'student',                                                          // all students
  'student_female',                                                   // female students only
  'faculty',                                                          // all faculty
  'faculty_male',                                                     // male faculty only
  'faculty_female',                                                   // female faculty only
  'commercial',                                                       // commercial / outsiders
  'any',                                                              // any role
  'everyone',                                                         // everyone
];
const VALID_TIMETABLES = ['all', 'standard', 'tournament'];           // all timetable types

// =============================================================
// GET /  -  SYSTEM SETTINGS (READ ONLY)
// =============================================================

router.get('/', requireAdmin, async (req, res) => {
  try {
    const today = bhutanNow().date;                                   // today's date in Bhutan
    const [facilities, rules, users, tournament, blocks] = await Promise.all([   // run all queries at the same time
      pool.query(                                                     // all facilities
        `SELECT id, name, type, group_name, court_label, max_duration_minutes, is_active
         FROM facilities ORDER BY id`,
      ),
      pool.query(                                                     // all schedule rules
        `SELECT id, facility_id, day_of_week,
                to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time,
                primary_role, fallback_role, fallback_type, timetable, day_booking_cap
         FROM schedule_rules ORDER BY facility_id, day_of_week, start_time`,
      ),
      pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role <> 'admin'`),   // number of users, not counting admins
      pool.query(                                                     // tournament that is running today
        `SELECT name, to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date
         FROM tournament_periods WHERE $1::date BETWEEN start_date AND end_date
         ORDER BY start_date LIMIT 1`,
        [today],                                                      // $1 is today
      ),
      pool.query(                                                     // number of facilities in maintenance today
        `SELECT COUNT(DISTINCT facility_id)::int AS n FROM maintenance_blocks
         WHERE $1::date BETWEEN start_date AND end_date`,
        [today],                                                      // $1 is today
      ),
    ]);

    res.json({                                                        // send everything together
      today,                                                          // today's date
      facilities: facilities.rows,                                    // all facilities
      rules: rules.rows,                                              // all schedule rules
      info: {                                                         // a few live system numbers
        registered_users: users.rows[0].n,                            // number of users
        open_facilities: facilities.rows.filter((f) => f.is_active).length,   // facilities that are open
        total_facilities: facilities.rows.length,                     // all facilities
        facilities_in_maintenance: blocks.rows[0].n,                  // facilities in maintenance today
        active_tournament: tournament.rows[0] || null,                // running tournament, or null
      },
    });
  } catch (err) {
    console.error(err);                                               // show the error in the server console
    res.status(500).json({ error: 'Failed to load system settings' });   // tell the client it failed
  }
});

// =============================================================
// HELPER FUNCTIONS
// =============================================================

// ---- check and clean the schedule rule input ------------------
// it gives back { error } if something is wrong, or { value } if all is good
function scheduleBody(body) {
  const facilityId = Number(body.facility_id);                        // facility id as a number
  const day = Number(body.day_of_week);                               // day of week, 0 = Sunday
  const start = String(body.start_time || '');                        // start time as text
  const end = String(body.end_time || '');                            // end time as text
  const role = String(body.primary_role || '');                       // main role that can book
  const timetable = VALID_TIMETABLES.includes(body.timetable) ? body.timetable : 'all';   // default is all
  const fallbackRole = body.fallback_role ? String(body.fallback_role) : null;            // backup role, null if empty
  const fallbackType = ['auto_release', 'day_start_release', 'weekly_release'].includes(  // when the slot opens to the backup role
    body.fallback_type,
  )
    ? body.fallback_type
    : 'none';                                                         // default is none

  if (!Number.isInteger(facilityId) || facilityId < 1) return { error: 'Choose a valid facility.' };   // facility check
  if (!Number.isInteger(day) || day < 0 || day > 6) return { error: 'Choose a valid day.' };           // day must be 0 to 6
  if (
    !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(start) ||            // start must look like HH:MM
    !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(end)                 // end must look like HH:MM
  ) {
    return { error: 'Enter valid start and end times.' };
  }
  if (end <= start) return { error: 'End time must be later than start time.' };       // end must be after start
  if (!VALID_ROLES.includes(role)) return { error: 'Choose a valid booking role.' };   // role must be an allowed one
  const cap =
    body.day_booking_cap === '' || body.day_booking_cap == null
      ? null                                                          // no daily limit
      : Number(body.day_booking_cap);                                 // daily booking limit
  if (cap !== null && (!Number.isInteger(cap) || cap < 1))            // limit must be a positive whole number
    return { error: 'Daily booking limit must be a positive whole number.' };
  return {
    value: {                                                          // all the cleaned values
      facilityId,
      day,
      start: start.slice(0, 5),                                       // keep only HH:MM
      end: end.slice(0, 5),                                           // keep only HH:MM
      role,
      timetable,
      fallbackRole,
      fallbackType,
      cap,
    },
  };
}

// ---- check if the rule time overlaps another rule -------------
// excludeId is the rule we are editing, so it does not overlap with itself
async function overlapExists(client, value, excludeId = 0) {
  const result = await client.query(
    `SELECT 1 FROM schedule_rules
     WHERE facility_id = $1 AND day_of_week = $2
      AND (timetable = 'all' OR $3 = 'all' OR timetable = $3) AND id <> $6
       AND start_time < $5::time AND end_time > $4::time LIMIT 1`,
    [value.facilityId, value.day, value.timetable, value.start, value.end, excludeId],   // values for $1 to $6
  );
  return result.rows.length > 0;                                      // true if an overlap was found
}

// =============================================================
// POST /rules  -  ADD A SCHEDULE RULE
// =============================================================

router.post('/rules', requireAdmin, async (req, res) => {
  const checked = scheduleBody(req.body);                             // check and clean the input
  if (checked.error) return res.status(400).json({ error: checked.error });   // stop if the input is wrong
  const value = checked.value;                                        // the cleaned values
  const client = await pool.connect();                                // get one database connection
  try {
    if (await overlapExists(client, value))                           // time must not overlap another rule
      return res.status(409).json({ error: 'This time overlaps another rule for the same day.' });
    const saved = await client.query(                                 // add the new rule
      `INSERT INTO schedule_rules
       (facility_id, day_of_week, start_time, end_time, primary_role, fallback_role, fallback_type, timetable, day_booking_cap, notes)
       VALUES ($1,$2,$3::time,$4::time,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        value.facilityId,                                             // $1
        value.day,                                                    // $2
        value.start,                                                  // $3
        value.end,                                                    // $4
        value.role,                                                   // $5
        value.fallbackRole,                                           // $6
        value.fallbackType,                                           // $7
        value.timetable,                                              // $8
        value.cap,                                                    // $9
        String(req.body.notes || '').trim() || null,                  // $10, notes, null if empty
      ],
    );
    res.status(201).json({ id: saved.rows[0].id });                   // send the new rule id back
  } catch (err) {
    console.error(err);                                               // show the error in the server console
    res.status(500).json({ error: 'Failed to add schedule rule' });   // tell the client it failed
  } finally {
    client.release();                                                 // give the connection back
  }
});

// =============================================================
// PUT /rules/:id  -  EDIT A SCHEDULE RULE
// =============================================================

router.put('/rules/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);                                   // change the id from text to a number
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid schedule rule.' });   // id must be a whole number
  const checked = scheduleBody(req.body);                             // check and clean the input
  if (checked.error) return res.status(400).json({ error: checked.error });   // stop if the input is wrong
  const value = checked.value;                                        // the cleaned values
  const client = await pool.connect();                                // get one database connection
  try {
    if (await overlapExists(client, value, id))                       // overlap check, ignore this rule itself
      return res.status(409).json({ error: 'This time overlaps another rule for the same day.' });
    const updated = await client.query(                               // update the rule
      `UPDATE schedule_rules SET facility_id=$1, day_of_week=$2, start_time=$3::time, end_time=$4::time,
       primary_role=$5, fallback_role=$6, fallback_type=$7, timetable=$8, day_booking_cap=$9, notes=$10
       WHERE id=$11 RETURNING id`,
      [
        value.facilityId,                                             // $1
        value.day,                                                    // $2
        value.start,                                                  // $3
        value.end,                                                    // $4
        value.role,                                                   // $5
        value.fallbackRole,                                           // $6
        value.fallbackType,                                           // $7
        value.timetable,                                              // $8
        value.cap,                                                    // $9
        String(req.body.notes || '').trim() || null,                  // $10, notes, null if empty
        id,                                                           // $11, the rule id
      ],
    );
    if (!updated.rows.length) return res.status(404).json({ error: 'Schedule rule not found.' });   // rule does not exist
    res.json({ id });                                                 // send the rule id back
  } catch (err) {
    console.error(err);                                               // show the error in the server console
    res.status(500).json({ error: 'Failed to update schedule rule' });   // tell the client it failed
  } finally {
    client.release();                                                 // give the connection back
  }
});

// =============================================================
// DELETE /rules/:id  -  DELETE A SCHEDULE RULE
// =============================================================

router.delete('/rules/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);                                   // change the id from text to a number
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid schedule rule.' });   // id must be a whole number
  try {
    const deleted = await pool.query('DELETE FROM schedule_rules WHERE id=$1 RETURNING id', [id]);   // delete the rule
    if (!deleted.rows.length) return res.status(404).json({ error: 'Schedule rule not found.' });    // rule does not exist
    res.json({ id });                                                 // send the deleted rule id back
  } catch (err) {
    console.error(err);                                               // show the error in the server console
    res.status(500).json({ error: 'Failed to delete schedule rule' });   // tell the client it failed
  }
});

module.exports = router;                                              // share the router so the main app can use it
