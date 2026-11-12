// =============================================================
// Backend/src/routes/adminFacilities.js
// "Facilities Status" admin page
// =============================================================
// GET   /admin/facilities        every facility with today's bookings, status,
//                                next free slot, plus upcoming/active downtime
// POST  /admin/facilities        add a new sport / court (with default opening hours)
// PATCH /admin/facilities/:id    allow / stop reservations, or edit details

// =============================================================
// IMPORTS AND SETUP
// =============================================================

const express = require('express');                                    // express makes the routes
const pool = require('../db');                                         // database connection
const { requireAdmin } = require('../auth');                           // middleware, allows admins only
const { bhutanNow, toMin, isValidTime } = require('../time');          // time helper functions
const router = express.Router();                                       // new router for this file

// =============================================================
// CONSTANTS
// =============================================================

const PRIMARY_ROLES = ['everyone', 'student'];                         // who may book a newly added facility
const MAX_DATA_URL = 700000;                                           // max image size in characters, about 500 KB
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;   // pattern of an uploaded image (data URL)

// =============================================================
// HELPER FUNCTIONS
// =============================================================

// ---- notify all users when a facility opens or closes ---------
async function notifyFacilityStatus(queryable, facilityName, isActive) {
  const message = isActive                                             // choose the message by status
    ? `${facilityName} is open for reservations again.`                // facility is open again
    : `${facilityName} is closed for new reservations. Existing bookings have not been cancelled.`;   // facility is closed
  await queryable.query(                                               // save one notification for each user
    `INSERT INTO notifications (user_id, type, message)
     SELECT id, 'facility_status', $1
     FROM users
     WHERE is_active IS TRUE AND role <> 'admin'`,                     // only active users, not admins
    [message],                                                         // $1 is the message
  );
}

// ---- date and time helpers ------------------------------------
function addDays(dateStr, n) {                                         // move a date by n days
  const d = new Date(`${dateStr}T00:00:00Z`);                          // make a date from the text
  d.setUTCDate(d.getUTCDate() + n);                                    // add the days
  return d.toISOString().slice(0, 10);                                 // back to YYYY-MM-DD text
}
const dow = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // day of week, 0 = Sunday
const hhmm = (min) =>                                                  // minutes of the day to HH:MM
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// ---- input cleaning helpers -----------------------------------
const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');   // trim text and cut to max length
const slug = (v) =>                                                    // make text safe, like "Table Tennis" -> "table_tennis"
  String(v)
    .toLowerCase()                                                     // make it lowercase
    .replace(/[^a-z0-9]+/g, '_')                                       // change other characters to _
    .replace(/^_+|_+$/g, '');                                          // remove _ at the start and end

// An image is either an uploaded photo (compressed data URL) or a web address / site path.
const cleanImage = (v) => (typeof v === 'string' ? v.trim() : '');     // trim the image text
const validImage = (v) => {                                            // check the image is allowed
  if (!v) return true;                                                 // no image is fine
  if (v.startsWith('data:')) return v.length <= MAX_DATA_URL && DATA_URL.test(v);   // uploaded photo: size and format
  return v.length <= 300 && /^(https?:\/\/|\/)[^\s"'<>]+$/.test(v);    // web address or site path
};

// ---- find the first free slot in the next 7 days --------------
// it ignores who is allowed to book the slot
function nextFreeSlot(fac, ctx) {
  const slotMin = fac.max_duration_minutes || 120;                     // same step the public summary uses
  for (let offset = 0; offset < 7; offset += 1) {                      // check today and the next 6 days
    const date = addDays(ctx.today, offset);                           // the date we are checking
    if (
      ctx.blocks.some((b) => b.facility_id === fac.id && b.start_date <= date && date <= b.end_date)   // facility is in maintenance
    )
      continue;                                                        // skip this day

    const timetable = ctx.tournaments.some((t) => t.start_date <= date && date <= t.end_date)   // is it a tournament day
      ? 'tournament'
      : 'standard';
    const rules = ctx.rules.filter(                                    // rules that apply to this facility and day
      (r) =>
        r.facility_id === fac.id &&                                    // same facility
        r.day_of_week === dow(date) &&                                 // same day of week
        ['all', timetable].includes(r.timetable) &&                    // same timetable
        r.primary_role !== 'maintenance',                              // not a maintenance rule
    );
    const booked = ctx.bookings.filter((b) => b.facility_id === fac.id && b.booking_date === date);   // bookings of this day

    const capped = rules.filter((r) => r.day_booking_cap);             // rules that have a daily booking limit
    const cap = capped.length ? capped[0].day_booking_cap : null;      // the limit number
    const usedInCap = booked.filter((b) =>                             // bookings already used inside the limited rules
      capped.some(
        (r) => toMin(r.start_time) <= toMin(b.start_time) && toMin(r.end_time) >= toMin(b.end_time),
      ),
    ).length;                                                          // Count bookings that use the daily limit.

    const candidates = [];                                             // start times that are free
    for (const r of rules) {                                           // go through each rule
      if (r.day_booking_cap && usedInCap >= cap) continue;             // limit reached, skip this rule
      for (let s = toMin(r.start_time); s + slotMin <= toMin(r.end_time); s += slotMin) {   // go through each slot
        const e = s + slotMin;                                         // end of the slot
        const past = offset === 0 && s <= ctx.nowMinutes;              // slot already started today
        const taken = booked.some((b) => toMin(b.start_time) < e && toMin(b.end_time) > s);   // slot overlaps a booking
        if (!past && !taken) candidates.push(s);                       // free slot, save it
      }
    }
    if (candidates.length) return { date, start_time: hhmm(Math.min(...candidates)) };   // give the earliest free slot
  }
  return null;                                                         // no free slot in 7 days
}

// =============================================================
// GET /  -  LIST ALL FACILITIES
// =============================================================

router.get('/', requireAdmin, async (req, res) => {
  try {
    const now = bhutanNow();                                           // current Bhutan date and time
    const today = now.date;                                            // today's date
    const horizon = addDays(today, 6);                                 // last day we look at (6 days ahead)
    const [facilities, rules, bookings, blocks, tournaments] = await Promise.all([   // run all queries at the same time
      pool.query(                                                      // all facilities
        `SELECT id, name, type, group_name, court_label, capacity, location, max_duration_minutes,
                description, image_url, is_active
         FROM facilities ORDER BY id`,
      ),
      pool.query(                                                      // all weekly schedule rules
        `SELECT facility_id, day_of_week, to_char(start_time,'HH24:MI') AS start_time,
                to_char(end_time,'HH24:MI') AS end_time, primary_role, timetable, day_booking_cap
         FROM schedule_rules`,
      ),
      pool.query(                                                      // live bookings for the next 7 days
        `SELECT facility_id, to_char(booking_date,'YYYY-MM-DD') AS booking_date,
                to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time
         FROM bookings WHERE status NOT IN ('cancelled', 'expired') AND booking_date BETWEEN $1 AND $2`,
        [today, horizon],                                              // $1 today, $2 last day
      ),
      pool.query(                                                      // maintenance that is active or coming
        `SELECT m.id, m.facility_id, f.name AS facility_name, m.reason,
                to_char(m.start_date,'YYYY-MM-DD') AS start_date, to_char(m.end_date,'YYYY-MM-DD') AS end_date
         FROM maintenance_blocks m JOIN facilities f ON f.id = m.facility_id
         WHERE m.end_date >= $1::date ORDER BY m.start_date, m.id`,
        [today],                                                       // $1 is today
      ),
      pool.query(                                                      // tournament periods
        `SELECT to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date
         FROM tournament_periods`,
      ),
    ]);

    const ctx = {                                                      // all data the nextFreeSlot function needs
      today,                                                           // today's date
      nowMinutes: now.minutes,                                         // minutes passed today
      rules: rules.rows,                                               // schedule rules
      bookings: bookings.rows,                                         // live bookings
      blocks: blocks.rows,                                             // maintenance blocks
      tournaments: tournaments.rows,                                   // tournament periods
    };

    const list = facilities.rows.map((f) => {                          // build the data of each facility
      const closedByMaintenance = blocks.rows.some(                    // is it in maintenance today
        (b) => b.facility_id === f.id && b.start_date <= today && today <= b.end_date,
      );
      const status = !f.is_active ? 'closed' : closedByMaintenance ? 'maintenance' : 'active';   // closed, maintenance or active
      return {
        ...f,                                                          // keep all facility details
        status,                                                        // add the status
        today_bookings: bookings.rows.filter(                          // number of bookings today
          (b) => b.facility_id === f.id && b.booking_date === today,
        ).length,
        next_slot: f.is_active ? nextFreeSlot(f, ctx) : null,          // next free slot, only if the facility is open
      };
    });

    const downtime = blocks.rows.map((b) => ({                         // maintenance list with its state
      ...b,                                                            // keep all block details
      state: b.start_date <= today ? 'active' : 'upcoming',            // active now or coming later
    }));

    res.json({ today, facilities: list, downtime });                   // send everything together
  } catch (err) {
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to load facilities' });      // tell the client it failed
  }
});

// =============================================================
// POST /  -  ADD A NEW FACILITY
// =============================================================

router.post('/', requireAdmin, async (req, res) => {
  // ---- read and clean the input ----
  const name = cleanText(req.body.name, 50);                           // facility name
  const sport = cleanText(req.body.type, 50);                          // sport type
  const group = cleanText(req.body.group_name, 50) || name;            // group name, default is the name
  const courtLabel = cleanText(req.body.court_label, 50) || null;      // court label, null if empty
  const location = cleanText(req.body.location, 100) || 'Main Campus'; // location, default Main Campus
  const description = cleanText(req.body.description, 600) || null;    // description, null if empty
  const imageUrl = cleanImage(req.body.image_url) || null;             // image, null if empty
  const capacity =
    req.body.capacity === '' || req.body.capacity == null ? null : Number(req.body.capacity);   // capacity, null if empty
  const maxMinutes = Number(req.body.max_duration_minutes ?? 60);      // max booking length, default 60
  const role = req.body.role || 'everyone';                            // who can book, default everyone
  const hours = req.body.hours || {};                                  // opening hours
  const isActive = req.body.is_active !== false;                       // false = created as temporarily unavailable

  // ---- check the input ----
  if (!name) return res.status(400).json({ error: 'Facility name is required' });                // name is needed
  if (!sport || !slug(sport)) return res.status(400).json({ error: 'Sport type is required' });  // sport is needed
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {                     // capacity must be a whole number
    return res.status(400).json({ error: 'Capacity must be a whole number above 0' }); // Return an error for invalid capacity.
  }
  if (!Number.isInteger(maxMinutes) || maxMinutes < 15 || maxMinutes > 480) {                    // 15 to 480 minutes
    return res
      .status(400)
      .json({ error: 'Maximum booking length must be between 15 and 480 minutes' }); // Return an error for an invalid booking length.
  }
  if (!PRIMARY_ROLES.includes(role))                                   // role must be an allowed one
    return res.status(400).json({ error: 'Choose who can book this facility' }); // Return an error for an unsupported role.
  if (!validImage(imageUrl))                                           // image must be valid
    return res
      .status(400)
      .json({ error: 'Image must be a JPG, PNG or WEBP photo under 500 KB (or a web address)' }); // Return an error for an invalid image.

  // ---- default opening hours: weekdays and weekends ----
  const windows = [
    ['weekday', hours.weekday_start, hours.weekday_end, [1, 2, 3, 4, 5]],   // Monday to Friday
    ['weekend', hours.weekend_start, hours.weekend_end, [0, 6]],            // Sunday and Saturday
  ];
  for (const [label, start, end] of windows) {                         // check each opening window
    if (!isValidTime(start) || !isValidTime(end) || toMin(end) <= toMin(start)) {   // times must be valid, close after open
      return res
        .status(400)
        .json({ error: `Enter valid ${label} opening hours (closing must be after opening)` }); // Return an error for invalid hours.
    }
    if (toMin(end) - toMin(start) < maxMinutes) {                      // window must fit at least one booking
      return res
        .status(400)
        .json({ error: `The ${label} opening window is shorter than one booking` }); // Return an error if the window is too short.
    }
  }

  // ---- save to the database (all or nothing) ----
  const client = await pool.connect();                                 // get one connection for the transaction
  try {
    await client.query('BEGIN');                                       // start the transaction
    const inserted = await client.query(                               // add the facility
      `INSERT INTO facilities (name, type, group_name, court_label, capacity, location,
                               max_duration_minutes, description, image_url, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, name, type, group_name, court_label, capacity, location, max_duration_minutes,
                 description, image_url, is_active`,
      [
        name,                                                          // $1
        slug(sport),                                                   // $2
        group,                                                         // $3
        courtLabel,                                                    // $4
        capacity,                                                      // $5
        location,                                                      // $6
        maxMinutes,                                                    // $7
        description,                                                   // $8
        imageUrl,                                                      // $9
        isActive,                                                      // $10
      ],
    );
    const facility = inserted.rows[0];                                 // the new facility
    for (const [label, start, end, days] of windows) {                 // add the opening hours rules
      for (const day of days) {                                        // one rule for each day
        await client.query(
          `INSERT INTO schedule_rules (facility_id, day_of_week, start_time, end_time, primary_role, fallback_type, notes)
           VALUES ($1,$2,$3,$4,$5,'none',$6)`,
          [facility.id, day, start, end, role, `Default ${label} hours (added by admin)`],   // values for $1 to $6
        );
      }
    }
    await client.query('COMMIT');                                      // save everything
    res.status(201).json({ facility });                                // send the new facility back
  } catch (err) {
    await client.query('ROLLBACK');                                    // undo everything if there is an error
    if (err.code === '23505')                                          // 23505 = name already exists
      return res.status(409).json({ error: 'A facility with that name already exists' }); // Return an error if the name is already used.
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to add facility' });         // tell the client it failed
  } finally {
    client.release();                                                  // give the connection back
  }
});

// =============================================================
// PATCH /:id  -  EDIT A FACILITY OR OPEN / CLOSE IT
// =============================================================

router.patch('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);                                    // change the id from text to a number
  if (!Number.isSafeInteger(id) || id <= 0)                            // id must be a positive whole number
    return res.status(400).json({ error: 'Invalid facility id' }); // Return an error for an invalid facility id.

  const sets = [];                                                     // SQL parts, like "name = $1"
  const values = [];                                                   // values for $1, $2, $3 ...
  const add = (column, value) => {                                     // helper to add one column to the update
    values.push(value);                                                // save the value
    sets.push(`${column} = $${values.length}`);                        // save the SQL part with its position
  };

  // ---- open / close ----
  if ('is_active' in req.body) {                                       // only if it was sent
    if (typeof req.body.is_active !== 'boolean')                       // must be true or false
      return res.status(400).json({ error: 'is_active must be true or false' }); // Return an error if the value is not true or false.
    add('is_active', req.body.is_active);
  }

  // ---- name ----
  if ('name' in req.body) {                                            // only if it was sent
    const name = cleanText(req.body.name, 50);                         // clean the name
    if (!name) return res.status(400).json({ error: 'Facility name cannot be empty' });   // name is needed
    add('name', name);
  }

  // ---- description and location ----
  if ('description' in req.body) add('description', cleanText(req.body.description, 600) || null);   // null if empty
  if ('location' in req.body) add('location', cleanText(req.body.location, 100) || null);           // null if empty

  // ---- image ----
  if ('image_url' in req.body) {                                       // only if it was sent
    const image = cleanImage(req.body.image_url) || null;              // clean the image, null if empty
    if (!validImage(image))                                            // image must be valid
      return res
        .status(400)
        .json({ error: 'Image must be a JPG, PNG or WEBP photo under 500 KB (or a web address)' });
    add('image_url', image);
  }

  // ---- capacity ----
  if ('capacity' in req.body) {                                        // only if it was sent
    const capacity =
      req.body.capacity === '' || req.body.capacity == null ? null : Number(req.body.capacity);   // null if empty
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {                    // must be a whole number
      return res.status(400).json({ error: 'Capacity must be a whole number above 0' }); // Return an error for invalid capacity.
    }
    add('capacity', capacity);
  }

  if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });   // no field was sent

  // ---- save to the database (all or nothing) ----
  let client;                                                          // the database connection
  let transactionStarted = false;                                      // true after BEGIN, used for rollback
  try {
    client = await pool.connect();                                     // get one connection
    await client.query('BEGIN');                                       // start the transaction
    transactionStarted = true;

    const previous = await client.query(                               // read the old status and lock the row
      'SELECT is_active FROM facilities WHERE id = $1 FOR UPDATE',
      [id],                                                            // $1 is the facility id
    );
    if (previous.rows.length === 0) {                                  // facility does not exist
      await client.query('ROLLBACK');                                  // undo
      transactionStarted = false;
      return res.status(404).json({ error: 'Facility not found' });
    }

    values.push(id);                                                   // facility id goes last, used in WHERE
    const result = await client.query(                                 // update only the fields that were sent
      `UPDATE facilities SET ${sets.join(', ')} WHERE id = $${values.length}
       RETURNING id, name, is_active`,
      values,
    );
    if (result.rows.length === 0) {                                    // no row updated
      await client.query('ROLLBACK');                                  // undo
      transactionStarted = false;                                      // record that the transaction is closed
      return res.status(404).json({ error: 'Facility not found' });
    }

    const facility = result.rows[0];                                   // the updated facility
    if ('is_active' in req.body && previous.rows[0].is_active !== facility.is_active) {   // status really changed
      await notifyFacilityStatus(client, facility.name, facility.is_active);              // tell all users
    }

    // Closing a facility never cancels bookings; tell the admin how many are still ahead.
    let upcoming = 0;                                                  // number of upcoming bookings
    if (req.body.is_active === false) {                                // only when closing
      const count = await client.query(                                // count live bookings from today
        `SELECT COUNT(*)::int AS n FROM bookings
         WHERE facility_id = $1 AND status NOT IN ('cancelled', 'expired') AND booking_date >= $2::date`,
        [id, bhutanNow().date],                                        // $1 facility id, $2 today
      );
      upcoming = count.rows[0].n;                                      // save the number
    }
    await client.query('COMMIT');                                      // save everything
    transactionStarted = false;                                        // record that the transaction is closed
    res.json({ facility, upcoming_bookings: upcoming });               // send the result back
  } catch (err) {
    if (client && transactionStarted) {                                // undo if the transaction is still open
      await client.query('ROLLBACK');
      transactionStarted = false;                                      // record that the transaction is closed
    }
    if (err.code === '23505')                                          // 23505 = name already exists
      return res.status(409).json({ error: 'A facility with that name already exists' }); // Return an error if the name is already used.
    console.error(err);                                                // show the error in the server console
    res.status(500).json({ error: 'Failed to update facility' });      // Return an error if the update fails.
  } finally {
    client?.release();                                                 // give the connection back
  }
});

module.exports = router;                                               // share the router so the main app can use it