// =============================================================
// Backend/src/routes/adminFacilities.js  —  "Facilities Status" admin page
// =============================================================
// GET   /admin/facilities        every facility with today's bookings, status,
//                                next free slot, plus upcoming/active downtime
// POST  /admin/facilities        add a new sport / court (with default opening hours)
// PATCH /admin/facilities/:id    allow / stop reservations, or edit details
const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../auth');
const { bhutanNow, toMin, isValidTime } = require('../time');
const router = express.Router();

const PRIMARY_ROLES = ['everyone', 'student']; // who may book a newly added facility

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dow = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// First free slot in the next 7 days, ignoring who is allowed to book it.
function nextFreeSlot(fac, ctx) {
  const slotMin = fac.max_duration_minutes || 120; // same step the public summary uses
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(ctx.today, offset);
    if (ctx.blocks.some((b) => b.facility_id === fac.id && b.start_date <= date && date <= b.end_date)) continue;

    const timetable = ctx.tournaments.some((t) => t.start_date <= date && date <= t.end_date) ? 'tournament' : 'standard';
    const rules = ctx.rules.filter((r) =>
      r.facility_id === fac.id && r.day_of_week === dow(date) &&
      ['all', timetable].includes(r.timetable) && r.primary_role !== 'maintenance');
    const booked = ctx.bookings.filter((b) => b.facility_id === fac.id && b.booking_date === date);

    const capped = rules.filter((r) => r.day_booking_cap);
    const cap = capped.length ? capped[0].day_booking_cap : null;
    const usedInCap = booked.filter((b) => capped.some(
      (r) => toMin(r.start_time) <= toMin(b.start_time) && toMin(r.end_time) >= toMin(b.end_time))).length;

    const candidates = [];
    for (const r of rules) {
      if (r.day_booking_cap && usedInCap >= cap) continue;
      for (let s = toMin(r.start_time); s + slotMin <= toMin(r.end_time); s += slotMin) {
        const e = s + slotMin;
        const past = offset === 0 && s <= ctx.nowMinutes;
        const taken = booked.some((b) => toMin(b.start_time) < e && toMin(b.end_time) > s);
        if (!past && !taken) candidates.push(s);
      }
    }
    if (candidates.length) return { date, start_time: hhmm(Math.min(...candidates)) };
  }
  return null;
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const now = bhutanNow();
    const today = now.date;
    const horizon = addDays(today, 6);
    const [facilities, rules, bookings, blocks, tournaments] = await Promise.all([
      pool.query(
        `SELECT id, name, type, group_name, court_label, capacity, location, max_duration_minutes,
                description, image_url, is_active
         FROM facilities ORDER BY id`),
      pool.query(
        `SELECT facility_id, day_of_week, to_char(start_time,'HH24:MI') AS start_time,
                to_char(end_time,'HH24:MI') AS end_time, primary_role, timetable, day_booking_cap
         FROM schedule_rules`),
      pool.query(
        `SELECT facility_id, to_char(booking_date,'YYYY-MM-DD') AS booking_date,
                to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time
         FROM bookings WHERE status <> 'cancelled' AND booking_date BETWEEN $1 AND $2`, [today, horizon]),
      pool.query(
        `SELECT m.id, m.facility_id, f.name AS facility_name, m.reason,
                to_char(m.start_date,'YYYY-MM-DD') AS start_date, to_char(m.end_date,'YYYY-MM-DD') AS end_date
         FROM maintenance_blocks m JOIN facilities f ON f.id = m.facility_id
         WHERE m.end_date >= $1::date ORDER BY m.start_date, m.id`, [today]),
      pool.query(
        `SELECT to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date
         FROM tournament_periods`),
    ]);

    const ctx = {
      today, nowMinutes: now.minutes,
      rules: rules.rows, bookings: bookings.rows, blocks: blocks.rows, tournaments: tournaments.rows,
    };

    const list = facilities.rows.map((f) => {
      const closedByMaintenance = blocks.rows.some(
        (b) => b.facility_id === f.id && b.start_date <= today && today <= b.end_date);
      const status = !f.is_active ? 'closed' : closedByMaintenance ? 'maintenance' : 'active';
      return {
        ...f,
        status,
        today_bookings: bookings.rows.filter((b) => b.facility_id === f.id && b.booking_date === today).length,
        next_slot: f.is_active ? nextFreeSlot(f, ctx) : null,
      };
    });

    const downtime = blocks.rows.map((b) => ({
      ...b,
      state: b.start_date <= today ? 'active' : 'upcoming',
    }));

    res.json({ today, facilities: list, downtime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load facilities' });
  }
});

const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const slug = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const validImage = (v) => !v || /^(https?:\/\/|\/)[^\s"'<>]+$/.test(v);

router.post('/', requireAdmin, async (req, res) => {
  const name = cleanText(req.body.name, 50);
  const sport = cleanText(req.body.type, 50);
  const group = cleanText(req.body.group_name, 50) || name;
  const courtLabel = cleanText(req.body.court_label, 50) || null;
  const location = cleanText(req.body.location, 100) || 'Main Campus';
  const description = cleanText(req.body.description, 600) || null;
  const imageUrl = cleanText(req.body.image_url, 300) || null;
  const capacity = req.body.capacity === '' || req.body.capacity == null ? null : Number(req.body.capacity);
  const maxMinutes = Number(req.body.max_duration_minutes ?? 60);
  const role = req.body.role || 'everyone';
  const hours = req.body.hours || {};

  if (!name) return res.status(400).json({ error: 'Facility name is required' });
  if (!sport || !slug(sport)) return res.status(400).json({ error: 'Sport type is required' });
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
    return res.status(400).json({ error: 'Capacity must be a whole number above 0' });
  }
  if (!Number.isInteger(maxMinutes) || maxMinutes < 15 || maxMinutes > 480) {
    return res.status(400).json({ error: 'Maximum booking length must be between 15 and 480 minutes' });
  }
  if (!PRIMARY_ROLES.includes(role)) return res.status(400).json({ error: 'Choose who can book this facility' });
  if (!validImage(imageUrl)) return res.status(400).json({ error: 'Image must be a web address (https://…) or a path starting with /' });

  const windows = [
    ['weekday', hours.weekday_start, hours.weekday_end, [1, 2, 3, 4, 5]],
    ['weekend', hours.weekend_start, hours.weekend_end, [0, 6]],
  ];
  for (const [label, start, end] of windows) {
    if (!isValidTime(start) || !isValidTime(end) || toMin(end) <= toMin(start)) {
      return res.status(400).json({ error: `Enter valid ${label} opening hours (closing must be after opening)` });
    }
    if (toMin(end) - toMin(start) < maxMinutes) {
      return res.status(400).json({ error: `The ${label} opening window is shorter than one booking` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO facilities (name, type, group_name, court_label, capacity, location,
                               max_duration_minutes, description, image_url, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       RETURNING id, name, type, group_name, court_label, capacity, location, max_duration_minutes,
                 description, image_url, is_active`,
      [name, slug(sport), group, courtLabel, capacity, location, maxMinutes, description, imageUrl]
    );
    const facility = inserted.rows[0];
    for (const [label, start, end, days] of windows) {
      for (const day of days) {
        await client.query(
          `INSERT INTO schedule_rules (facility_id, day_of_week, start_time, end_time, primary_role, fallback_type, notes)
           VALUES ($1,$2,$3,$4,$5,'none',$6)`,
          [facility.id, day, start, end, role, `Default ${label} hours (added by admin)`]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ facility });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'A facility with that name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to add facility' });
  } finally {
    client.release();
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid facility id' });

  const sets = [];
  const values = [];
  const add = (column, value) => { values.push(value); sets.push(`${column} = $${values.length}`); };

  if ('is_active' in req.body) {
    if (typeof req.body.is_active !== 'boolean') return res.status(400).json({ error: 'is_active must be true or false' });
    add('is_active', req.body.is_active);
  }
  if ('name' in req.body) {
    const name = cleanText(req.body.name, 50);
    if (!name) return res.status(400).json({ error: 'Facility name cannot be empty' });
    add('name', name);
  }
  if ('description' in req.body) add('description', cleanText(req.body.description, 600) || null);
  if ('location' in req.body) add('location', cleanText(req.body.location, 100) || null);
  if ('image_url' in req.body) {
    const image = cleanText(req.body.image_url, 300) || null;
    if (!validImage(image)) return res.status(400).json({ error: 'Image must be a web address (https://…) or a path starting with /' });
    add('image_url', image);
  }
  if ('capacity' in req.body) {
    const capacity = req.body.capacity === '' || req.body.capacity == null ? null : Number(req.body.capacity);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
      return res.status(400).json({ error: 'Capacity must be a whole number above 0' });
    }
    add('capacity', capacity);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  try {
    values.push(id);
    const result = await pool.query(
      `UPDATE facilities SET ${sets.join(', ')} WHERE id = $${values.length}
       RETURNING id, name, is_active`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });

    // Closing a facility never cancels bookings; tell the admin how many are still ahead.
    let upcoming = 0;
    if (req.body.is_active === false) {
      const count = await pool.query(
        `SELECT COUNT(*)::int AS n FROM bookings
         WHERE facility_id = $1 AND status <> 'cancelled' AND booking_date >= $2::date`,
        [id, bhutanNow().date]
      );
      upcoming = count.rows[0].n;
    }
    res.json({ facility: result.rows[0], upcoming_bookings: upcoming });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A facility with that name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update facility' });
  }
});

module.exports = router;
