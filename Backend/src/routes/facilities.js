// =============================================================
// Backend/src/routes/facilities.js
// =============================================================
// GET /facilities                        list every active court/ground
// GET /facilities/summary?date=          real slot counts per facility (Home + Facilities cards)
// GET /facilities/:id/availability?date= rules + bookings + maintenance for one day
const express = require('express'); // Load Express.
const pool = require('../db'); // Load the database pool.
const { bhutanNow, bookingWindow, toMin, dayOfWeek, isValidDate } = require('../time'); // Load date and time helpers.
const { timetableForDate } = require('../timetable'); // Load the timetable helper.
const router = express.Router(); // Create the router.

// ---------- 1. list ----------
router.get('/', async (req, res) => { // Get all active facilities.
  try {
    const result = await pool.query(
      `SELECT id, name, type, group_name, court_label, capacity, location, max_duration_minutes,
              description, image_url
       FROM facilities WHERE is_active = true ORDER BY id`, // Select active facilities by ID.
    );
    res.json(result.rows); // Send the facility list.
  } catch (err) {
    console.error(err); // Log the error.
    res.status(500).json({ error: 'Failed to fetch facilities' }); // Send an error response.
  }
});

// ---------- 2. summary (real numbers instead of hardcoded badges) ----------
// For the given date, counts how many bookable slots each facility has and
// how many are still free. A slot is NOT free if it is: already booked,
// in the past (today only), or inside a maintenance block. Slots whose rule
// is "maintenance / college team" are not counted at all.
router.get('/summary', async (req, res) => { // Get slot counts for each facility.
  try {
    const now = bhutanNow(); // Get the current Bhutan date and time.
    const date = req.query.date || now.date; // Use the requested date or today.
    if (!isValidDate(date))
      return res.status(400).json({ error: 'date must look like 2026-10-20' }); // Reject an invalid date.
    const dow = dayOfWeek(date); // Get the weekday.
    const timetable = await timetableForDate(pool, date); // Get the timetable for this date.

    const [facilities, rules, bookings, blocks] = await Promise.all([
      pool.query(
        'SELECT id, name, group_name, max_duration_minutes FROM facilities WHERE is_active = true ORDER BY id', // Get active facilities.
      ),
      pool.query(
        `SELECT DISTINCT facility_id, to_char(start_time,'HH24:MI') AS start_time,
                to_char(end_time,'HH24:MI') AS end_time, primary_role, day_booking_cap
         FROM schedule_rules WHERE day_of_week = $1 AND timetable IN ('all', $2)`, // Get rules for this weekday and timetable.
        [dow, timetable],
      ),
      pool.query(
        `SELECT facility_id, to_char(start_time,'HH24:MI') AS start_time,
                to_char(end_time,'HH24:MI') AS end_time
         FROM bookings WHERE booking_date = $1 AND status NOT IN ('cancelled', 'expired')`, // Get active bookings for this date.
        [date],
      ),
      pool.query(
        `SELECT facility_id FROM maintenance_blocks
         WHERE $1::date BETWEEN start_date AND end_date`, // Get maintenance for this date.
        [date],
      ),
    ]);

    const blockedIds = new Set(blocks.rows.map((b) => b.facility_id)); // Store IDs of closed facilities.

    const summary = facilities.rows.map((f) => { // Make a summary for each facility.
      const slotMin = f.max_duration_minutes || 120; // Set the slot length in minutes.
      const booked = bookings.rows.filter((b) => b.facility_id === f.id); // Get this facility's bookings.
      const bookable = rules.rows.filter(
        (r) => r.facility_id === f.id && r.primary_role !== 'maintenance', // Skip maintenance rules.
      );

      let total = 0; // Count all slots.
      let available = 0; // Count free slots.
      let cappedSlots = 0; // Count slots with a daily limit.
      let cappedFree = 0; // Count free slots with a daily limit.
      let cap = null; // Store the daily limit.
      for (const r of bookable) {
        for (let s = toMin(r.start_time); s + slotMin <= toMin(r.end_time); s += slotMin) {
          const e = s + slotMin; // Get the slot end time.
          const taken = booked.some((b) => toMin(b.start_time) < e && toMin(b.end_time) > s); // Check for an overlapping booking.
          const past = date < now.date || (date === now.date && s <= now.minutes); // Check if the slot has passed.
          const free = !taken && !past && !blockedIds.has(f.id); // Check if the slot is free.
          if (r.day_booking_cap) {
            cap = r.day_booking_cap; // Set the daily limit.
            cappedSlots += 1; // Count this limited slot.
            if (free) cappedFree += 1; // Count it if free.
          } else {
            total += 1; // Count this slot.
            if (free) available += 1; // Count it if free.
          }
        }
      }
      // Capped rules (weekend student matches): never more than `cap` bookings a day.
      if (cap) {
        const cappedRules = bookable.filter((r) => r.day_booking_cap); // Get rules with a daily limit.
        const used = booked.filter((b) =>
          cappedRules.some(
            (r) =>
              toMin(r.start_time) <= toMin(b.start_time) && toMin(r.end_time) >= toMin(b.end_time),
          ),
        ).length; // Count bookings under the daily limit.
        total += Math.min(cappedSlots, cap); // Add slots up to the daily limit.
        available += Math.max(0, Math.min(cappedFree, cap - used)); // Add free slots up to the remaining limit.
      }
      return {
        facility_id: f.id, // Add the facility ID.
        name: f.name, // Add the facility name.
        group_name: f.group_name, // Add the group name.
        total, // Add the total slot count.
        available, // Add the free slot count.
        blocked: blockedIds.has(f.id), // Show if maintenance blocks the facility.
      };
    });

    res.json({ date, facilities: summary }); // Send the summary.
  } catch (err) {
    console.error(err); // Log the error.
    res.status(500).json({ error: 'Failed to build availability summary' }); // Send an error response.
  }
});

// ---------- 3. availability for one facility on one day ----------
router.get('/:id/availability', async (req, res) => { // Get one facility's availability.
  const id = Number(req.params.id); // Convert the ID to a number.
  const date = req.query.date; // Get the requested date.
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid facility id' }); // Reject an invalid ID.
  if (!date || !isValidDate(date))
    return res.status(400).json({ error: 'date query param is required, e.g. ?date=2026-10-20' }); // Require a valid date.

  try {
    const dow = dayOfWeek(date); // Get the weekday.
    const timetable = await timetableForDate(pool, date); // Get the timetable for this date.
    const [rules, bookings, maintenance] = await Promise.all([
      pool.query(
        `SELECT to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time,
                primary_role, fallback_role, fallback_type, notes, day_booking_cap
         FROM schedule_rules WHERE facility_id = $1 AND day_of_week = $2
           AND timetable IN ('all', $3) ORDER BY start_time`, // Get this facility's rules for the day.
        [id, dow, timetable],
      ),
      pool.query(
        `SELECT to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time, status
         FROM bookings WHERE facility_id = $1 AND booking_date = $2
           AND status NOT IN ('cancelled', 'expired')
         ORDER BY start_time`, // Get this facility's bookings for the date.
        [id, date],
      ),
      pool.query(
        `SELECT reason FROM maintenance_blocks
         WHERE facility_id = $1 AND $2::date BETWEEN start_date AND end_date`, // Get maintenance for this date.
        [id, date],
      ),
    ]);

    // Has the daily cap (weekend student matches) been used up on this date?
    const capped = rules.rows.filter((r) => r.day_booking_cap); // Get rules with a daily limit.
    const cap = capped.length ? capped[0].day_booking_cap : null; // Get the daily limit.
    const usedInCap = bookings.rows.filter((b) =>
      capped.some(
        (r) => toMin(r.start_time) <= toMin(b.start_time) && toMin(r.end_time) >= toMin(b.end_time),
      ),
    ).length; // Count bookings under the daily limit.

    res.json({
      facility_id: id, // Add the facility ID.
      date, // Add the requested date.
      booking_window: bookingWindow(), // Add the booking window.
      day_of_week: dow, // Add the weekday.
      timetable, // 'tournament' | 'standard'
      cap_reached: cap !== null && usedInCap >= cap, // Show if the daily limit is reached.
      rules: rules.rows, // Add the schedule rules.
      existing_bookings: bookings.rows, // Add existing bookings.
      maintenance: maintenance.rows, // non-empty = facility closed that day
    });
  } catch (err) {
    console.error(err); // Log the error.
    res.status(500).json({ error: 'Failed to fetch availability' }); // Send an error response.
  }
});

module.exports = router; // Export the router.
