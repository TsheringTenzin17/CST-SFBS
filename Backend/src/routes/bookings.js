// =============================================================
// Backend/src/routes/bookings.js  —  EVERYTHING about bookings
// =============================================================
// POST   /bookings                         make a booking
// GET    /bookings/user/:userId            one user's own bookings        (My Bookings page)
// DELETE /bookings/:id/archive             hide an old completed booking from My Bookings
// PATCH  /bookings/:id/cancel              a user cancels their own booking
// GET    /bookings                         all bookings                   (admin only)
// GET    /bookings/:id/payment-proof       see payment proof              (admin only)
// PATCH  /bookings/:id/payment-resolution  refund / credit choice for an expired paid booking
// PATCH  /bookings/:id                     admin approves or cancels any booking
// PATCH  /bookings/:id/reschedule-request  a user moves their own booking
// PATCH  /bookings/:id/reschedule          admin moves a booking          (admin only)
//
// Layout of this file:
//   1. imports and constants
//   2. payment, notification and email helpers
//   A. helpers      B. validateSlot (rules shared by book + reschedule)
//   C. routes

// =============================================================
// 1. IMPORTS AND CONSTANTS
// =============================================================
const express = require('express');                                                                           // web framework to make routes
const pool = require('../db');                                                                                // our database connection
const { authenticate, requireAdmin } = require('../auth');                                                    // login check and admin-only check
const { notifyAdmins } = require('../adminNotify');    // Helper that emails the admin(s)
const {                                                                                                       // time helper functions (all use Bhutan time)
  bhutanNow,                                                                                                  // current date and time in Bhutan
  bookingWindow,                                                                                              // first and last date that can be booked
  isPastDayStartRelease,                                                                                      // true when the day-start release time has passed
  isPastWeeklyRelease,                                                                                        // true when the weekly release time has passed
  toMin,                                                                                                      // turns "HH:MM" into minutes
  hhmm,                                                                                                       // makes a time look like "HH:MM"
  dayOfWeek,                                                                                                  // gives the day number of a date
  isValidDate,                                                                                                // checks the date format
  isValidTime,                                                                                                // checks the time format
} = require('../time');                                                                                       // the file that has these time helpers
const { timetableForDate } = require('../timetable');                                                         // finds which timetable (standard or tournament) a date uses
const { sendEmail } = require('../email');                                                                    // helper to send emails
const router = express.Router();                                                                              // router to group all routes in this file

const PAYMENT_ACCOUNT_NUMBER = '221758633';                                                                   // account number users pay into
const NON_FOOTBALL_COMMERCIAL_FEE = 1500;                                                                     // fixed fee for non-football commercial bookings
const MAX_PAYMENT_SCREENSHOT_BYTES = 1.5 * 1024 * 1024;                                                       // biggest screenshot allowed (1.5 MB)

// =============================================================
// 2. PAYMENT, NOTIFICATION AND EMAIL HELPERS
// =============================================================

// checks the payment screenshot; returns an error text, or null when it is fine
function paymentScreenshotError(value) {                                                                      // start of paymentScreenshotError
  if (typeof value !== 'string') return 'A payment screenshot is required.';                                  // screenshot must be text (base64)
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);                   // must look like a base64 jpeg, png or webp image
  if (!match) return 'Upload a JPEG, PNG or WEBP payment screenshot.';                                        // wrong format
  const format = match[1];                                                                                    // image type: jpeg, png or webp
  const bytes = Buffer.from(match[2], 'base64');                                                              // turn the base64 text into real bytes
  if (bytes.length === 0 || bytes.length > MAX_PAYMENT_SCREENSHOT_BYTES) {                                    // empty or too big
    return 'The payment screenshot must be 1.5 MB or smaller.';                                               // send error text
  }                                                                                                           // end of size check
  const validSignature =                                                                                      // check the first bytes, so a fake file cannot pass as an image
    (format === 'png' &&                                                                                      // png files start with these 8 bytes
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||                         // compare the first 8 bytes
    (format === 'jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||                     // jpeg files start with ff d8 ff
    (format === 'webp' &&                                                                                     // webp files start with RIFF and have WEBP inside
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&                                                    // first 4 bytes say RIFF
      bytes.subarray(8, 12).toString('ascii') === 'WEBP');                                                    // bytes 8 to 12 say WEBP
  return validSignature ? null : 'The uploaded file is not a valid image.';                                   // null means OK, else an error text
}                                                                                                             // end of paymentScreenshotError

// works out how much the user must pay for a booking
function bookingPaymentAmount(facilityType, role, bookingDate, assistantReferees) {                           // start of bookingPaymentAmount
  if (facilityType !== 'football') return NON_FOOTBALL_COMMERCIAL_FEE;                                        // other facilities have one fixed fee
  const weekend = [0, 6].includes(dayOfWeek(bookingDate));                                                    // true if the day is a weekend day
  if (assistantReferees) return role === 'student' ? 2900 : weekend ? 4400 : 3900;                            // price with assistant referees
  return role === 'student' ? 2500 : weekend ? 4000 : 3500;                                                   // price without assistant referees
}                                                                                                             // end of bookingPaymentAmount

// saves a notification for the user (only if they did not turn booking updates off)
async function addBookingNotification(queryable, userId, type, message) {                                     // start of addBookingNotification
  // SQL below: get the user's booking_updates setting
  const preferences = await queryable.query(                                                                  // run the query
    'SELECT booking_updates FROM user_notification_preferences WHERE user_id = $1',
    [userId],                                                                                                 // value for $1
  );                                                                                                          // end of query
  // Missing preference rows use the enabled-by-default behavior from the settings API.
  if (preferences.rows[0]?.booking_updates === false) return;                                                 // user turned it off, so do nothing
  // SQL below: save the notification
  await queryable.query('INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)', [           // run the query
    userId,                                                                                                   // $1 who gets the notification
    type,                                                                                                     // $2 kind of notification
    message,                                                                                                  // $3 the text the user will see
  ]);                                                                                                         // end of query
}                                                                                                             // end of addBookingNotification

// sends an email about a booking change (never breaks the main request if it fails)
async function sendBookingUpdateEmail(                                                                        // start of sendBookingUpdateEmail
  userId,                                                                                                     // who gets the email
  facilityId,                                                                                                 // facility of the booking
  { subject, statusMessage, bookingDate, startTime, endTime, reason },                                        // email details
) {                                                                                                           // end of the inputs
  try {                                                                                                       // start of main work
    // SQL below: get the user's name, email, the facility name and the email setting
    const result = await pool.query(                                                                          // run the query
      `SELECT u.full_name, u.email, f.name AS facility_name,
              COALESCE(p.booking_updates, true) AS booking_updates
       FROM users u
       JOIN facilities f ON f.id = $2
       LEFT JOIN user_notification_preferences p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId, facilityId],                                                                                   // values for $1 and $2
    );                                                                                                        // end of query
    if (result.rows.length === 0) {                                                                           // user or facility not found
      throw new Error('Booking email recipient or facility was not found.');                                  // jump to the catch below
    }                                                                                                         // end of check

    const recipient = result.rows[0];                                                                         // the person who gets the email
    if (!recipient.booking_updates) return;                                                                   // they turned updates off, so do not send

    await sendEmail({                                                                                         // send the email
      to: recipient.email,                                                                                    // send to the user's email
      subject,                                                                                                // email title
      // email message (reason is added only if given)
      text: `Hello ${recipient.full_name},\n\n${statusMessage}\n\nFacility: ${recipient.facility_name}\nDate: ${bookingDate}\nTime: ${startTime}-${endTime}${reason ? `\nReason: ${reason}` : ''}\n\nCST-SFBS`,
    });                                                                                                       // end of sendEmail
  } catch (error) {                                                                                           // if anything failed
    console.error(`Could not send booking update email for user ${userId}:`, error);                          // only log it, the booking itself is already saved
  }                                                                                                           // end of try/catch
}                                                                                                             // end of sendBookingUpdateEmail

// ---------------------------------------------------------------
// A. HELPERS
// ---------------------------------------------------------------

// Which user roles may book a slot whose rule says `ruleRole`?
// 'any' = students and outsiders; 'everyone' also includes faculty/staff.
// 'student_female' is only for female students (needs users.gender).
function isRoleEligible(userRole, ruleRole, gender) {                                                         // start of isRoleEligible
  if (ruleRole === 'student_female') return userRole === 'student' && gender === 'female';                    // only female students
  if (ruleRole === 'everyone') return ['student', 'faculty', 'outsider'].includes(userRole);                  // all three roles
  if (ruleRole === 'any') return userRole === 'student' || userRole === 'outsider';                           // students and outsiders
  if (ruleRole === 'student') return userRole === 'student';                                                  // students only
  if (ruleRole === 'commercial') return ['student', 'faculty', 'outsider'].includes(userRole);                // commercial slots are open to all three roles
  if (['faculty', 'faculty_male', 'faculty_female'].includes(ruleRole))                                       // faculty-only rules
    return userRole === 'faculty';                                                                            // only faculty can book
  return false;                                                                                               // 'maintenance' and anything unknown: nobody can book these
}                                                                                                             // end of isRoleEligible

// Auto-release rules open a fallback group 1 hour before the slot starts.
// Uses Bhutan time.
function isWithinAutoReleaseWindow(bookingDate, startTime) {                                                  // start of isWithinAutoReleaseWindow
  const now = bhutanNow();                                                                                    // current Bhutan date and time
  if (bookingDate !== now.date) return false;                                                                 // only works on the same day
  const minutesUntil = toMin(startTime) - now.minutes;                                                        // minutes left before the slot starts
  return minutesUntil >= 0 && minutesUntil <= 60;                                                             // true if the slot starts within 1 hour
}                                                                                                             // end of isWithinAutoReleaseWindow

// Day-start release rule (Wednesday football, female students first):
// the primary group (female students) must book before 12:00 AM on the day.
// From 12:05 AM that day the fallback group (commercial / outsiders) may book.
// fallback_type = 'day_start_release'. Uses BHUTAN time.

// Decide whether `userRole` may book the slot covered by `rule`.
// Returns { ok: true, viaFallback? } or { ok: false, status, message }.
// viaFallback = true when the user got in through the fallback (commercial) group.
function checkEligibility(userRole, rule, bookingDate, startTime, gender) {                                   // start of checkEligibility
  if (userRole === 'admin') return { ok: true };                                                              // admin can always book
  if (rule.primary_role === 'maintenance') {                                                                  // slot is for maintenance / college team
    return {                                                                                                  // stop here with an error
      ok: false,                                                                                              // not allowed
      status: 403,                                                                                            // forbidden
      message: 'This slot is reserved for maintenance / college team practice.',                              // error text
    };                                                                                                        // end of the error
  }                                                                                                           // end of maintenance check
  const weeklyReleasePassed =                                                                                 // has the weekly release time passed?
    rule.fallback_type === 'weekly_release' && isPastWeeklyRelease(bookingDate);                              // only checked for weekly_release rules
  if (!weeklyReleasePassed && isRoleEligible(userRole, rule.primary_role, gender))                            // the main group can book before the release
    return { ok: true };                                                                                      // allowed
  if (                                                                                                        // fallback group with the weekly release rule
    rule.fallback_role &&                                                                                     // the rule has a fallback group
    rule.fallback_type === 'weekly_release' &&                                                                // and it is the weekly release type
    isRoleEligible(userRole, rule.fallback_role, gender)                                                      // and this user belongs to that fallback group
  ) {                                                                                                         // start of the block
    if (weeklyReleasePassed) return { ok: true, viaFallback: true };                                          // release time passed, so allowed through fallback
    return {                                                                                                  // too early, send an error
      ok: false,                                                                                              // not allowed
      status: 403,                                                                                            // forbidden
      // error text
      message: `This slot is reserved for ${RESERVED_FOR[rule.primary_role] || 'another group'} until Wednesday at 8:00 PM Bhutan time.`,
    };                                                                                                        // end of the error
  }                                                                                                           // end of weekly release block
  if (                                                                                                        // fallback group with the day-start release rule
    rule.fallback_role &&                                                                                     // the rule has a fallback group
    rule.fallback_type === 'day_start_release' &&                                                             // and it is the day-start release type
    isRoleEligible(userRole, rule.fallback_role, gender)                                                      // and this user belongs to that fallback group
  ) {                                                                                                         // start of the block
    if (isPastDayStartRelease(bookingDate)) return { ok: true, viaFallback: true };                           // release time passed, so allowed through fallback
    return {                                                                                                  // too early, send an error
      ok: false,                                                                                              // not allowed
      status: 403,                                                                                            // forbidden
      // error text
      message: `This slot is reserved for ${RESERVED_FOR[rule.primary_role] || 'another group'} until 12:00 AM on the day of the booking. It opens to everyone else from 12:05 AM that day.`,
    };                                                                                                        // end of the error
  }                                                                                                           // end of day-start release block
  if (                                                                                                        // fallback group with the auto release rule
    rule.fallback_role &&                                                                                     // the rule has a fallback group
    rule.fallback_type === 'auto_release' &&                                                                  // and it is the auto release type
    isRoleEligible(userRole, rule.fallback_role, gender)                                                      // and this user belongs to that fallback group
  ) {                                                                                                         // start of the block
    if (isWithinAutoReleaseWindow(bookingDate, startTime)) return { ok: true, viaFallback: true };            // within 1 hour of the start, so allowed
    return {                                                                                                  // too early, send an error
      ok: false,                                                                                              // not allowed
      status: 403,                                                                                            // forbidden
      // error text
      message: `This slot is reserved for ${RESERVED_FOR[rule.primary_role] || 'another group'} until 1 hour before it starts. Please try again closer to the time.`,
    };                                                                                                        // end of the error
  }                                                                                                           // end of auto release block
  if (RESERVED_FOR[rule.primary_role]) {                                                                      // slot belongs to a special group
    return {                                                                                                  // send an error
      ok: false,                                                                                              // not allowed
      status: 403,                                                                                            // forbidden
      message: `This slot is reserved for ${RESERVED_FOR[rule.primary_role]}.`,                               // error text
    };                                                                                                        // end of the error
  }                                                                                                           // end of reserved check
  return {                                                                                                    // last case: the role does not fit the rule
    ok: false,                                                                                                // not allowed
    status: 403,                                                                                              // forbidden
    message: `Role '${userRole}' is not eligible for this slot (${rule.primary_role}).`,                      // error text
  };                                                                                                          // end of the error
}                                                                                                             // end of checkEligibility

// names of the groups, used inside error messages
const RESERVED_FOR = {                                                                                        // start of RESERVED_FOR
  student_female: 'female students',                                                                          // rule name -> text
  faculty: 'faculty',                                                                                         // rule name -> text
  faculty_male: 'male faculty',                                                                               // rule name -> text
  faculty_female: 'female faculty',                                                                           // rule name -> text
};                                                                                                            // end of RESERVED_FOR

const CONFLICT_MESSAGE = 'This slot was just booked by someone else. Please choose another.';                 // error text when two people book the same slot

// ---------------------------------------------------------------
// B. validateSlot - the rules that apply to ANY booking or move
// ---------------------------------------------------------------
// Checks, in order: facility exists + is open, length limit, a schedule rule
// covers the time, no maintenance block, no overlapping booking.
// Must be called INSIDE a transaction that already holds the facility lock.
// `excludeBookingId` lets a reschedule ignore the booking being moved.
async function validateSlot(client, { facilityId, date, start, end, excludeBookingId = 0 }) {                 // start of validateSlot
  const window = bookingWindow();                                                                             // the first and last date that can be booked
  if (date < window.from || date > window.to) {                                                               // date is outside the allowed window
    return {                                                                                                  // stop here with an error
      ok: false,                                                                                              // not allowed
      status: 400,                                                                                            // bad request
      message: `Advance booking is limited to available dates ${window.from} through ${window.to}.`,          // error text
    };                                                                                                        // end of the error
  }                                                                                                           // end of window check

  // SQL below: get the facility type, its max booking length and whether it is open
  const fac = await client.query(                                                                             // run the query
    'SELECT type, max_duration_minutes, is_active FROM facilities WHERE id = $1',
    [facilityId],                                                                                             // value for $1
  );                                                                                                          // end of query
  if (fac.rows.length === 0) return { ok: false, status: 404, message: 'Facility not found' };                // facility does not exist
  if (!fac.rows[0].is_active)                                                                                 // facility is closed
    return { ok: false, status: 400, message: 'This facility is not open for booking' };                      // send error

  const length = toMin(end) - toMin(start);                                                                   // booking length in minutes
  const maxMin = fac.rows[0].max_duration_minutes;                                                            // longest booking this facility allows
  if (maxMin && length > maxMin) {                                                                            // booking is too long
    return {                                                                                                  // stop here with an error
      ok: false,                                                                                              // not allowed
      status: 400,                                                                                            // bad request
      message: `Bookings for this facility are limited to ${maxMin} minutes`,                                 // error text
    };                                                                                                        // end of the error
  }                                                                                                           // end of length check

  // Only the rules of today's timetable apply (tournament period or standard).
  const timetable = await timetableForDate(client, date);                                                     // which timetable this date uses
  // SQL below: find the schedule rule that covers this facility, day and time
  const ruleResult = await client.query(                                                                      // run the query
    `SELECT primary_role, fallback_role, fallback_type, day_booking_cap FROM schedule_rules
     WHERE facility_id = $1 AND day_of_week = $2
       AND timetable IN ('all', $5)
       AND start_time <= $3::time AND end_time >= $4::time
     ORDER BY start_time LIMIT 1`,
    [facilityId, dayOfWeek(date), start, end, timetable],                                                     // values for $1 to $5
  );                                                                                                          // end of query
  if (ruleResult.rows.length === 0) {                                                                         // no rule covers this time
    return {                                                                                                  // stop here with an error
      ok: false,                                                                                              // not allowed
      status: 400,                                                                                            // bad request
      message:                                                                                                // error text
        'No booking rule covers this facility/day/time. Pick a slot shown on the availability page.',         // tell user to pick a shown slot
    };                                                                                                        // end of the error
  }                                                                                                           // end of rule check

  // SQL below: check if the facility is closed for maintenance on this date
  const block = await client.query(                                                                           // run the query
    `SELECT reason FROM maintenance_blocks
     WHERE facility_id = $1 AND $2::date BETWEEN start_date AND end_date LIMIT 1`,
    [facilityId, date],                                                                                       // values for $1 and $2
  );                                                                                                          // end of query
  if (block.rows.length > 0) {                                                                                // a maintenance block exists
    const why = block.rows[0].reason ? `: ${block.rows[0].reason}` : '';                                      // add the reason if there is one
    return {                                                                                                  // stop here with an error
      ok: false,                                                                                              // not allowed
      status: 400,                                                                                            // bad request
      message: `This facility is closed for maintenance on that date${why}`,                                  // error text
    };                                                                                                        // end of the error
  }                                                                                                           // end of maintenance check

  // SQL below: check if another active booking overlaps this time
  const overlap = await client.query(                                                                         // run the query
    `SELECT 1 FROM bookings
     WHERE facility_id = $1 AND booking_date = $2 AND status NOT IN ('cancelled', 'expired')
       AND id <> $5 AND start_time < $4::time AND end_time > $3::time LIMIT 1`,
    [facilityId, date, start, end, excludeBookingId],                                                         // values for $1 to $5
  );                                                                                                          // end of query
  if (overlap.rows.length > 0) return { ok: false, status: 409, message: CONFLICT_MESSAGE };                  // slot already taken

  // Daily cap (weekend student matches): once `day_booking_cap` bookings exist
  // inside the capped rules of that day, the rest of the day closes.
  const rule = ruleResult.rows[0];                                                                            // the rule we found
  if (rule.day_booking_cap) {                                                                                 // this rule has a daily limit
    // SQL below: count today's bookings that fall inside rules that have a daily limit
    const used = await client.query(                                                                          // run the query
      `SELECT COUNT(*)::int AS n FROM bookings b
       WHERE b.facility_id = $1 AND b.booking_date = $2
         AND b.status NOT IN ('cancelled', 'expired') AND b.id <> $3
         AND EXISTS (
           SELECT 1 FROM schedule_rules r
           WHERE r.facility_id = b.facility_id AND r.day_of_week = $4
             AND r.day_booking_cap IS NOT NULL AND r.timetable IN ('all', $5)
             AND r.start_time <= b.start_time AND r.end_time >= b.end_time
         )`,
      [facilityId, date, excludeBookingId, dayOfWeek(date), timetable],                                       // values for $1 to $5
    );                                                                                                        // end of query
    if (used.rows[0].n >= rule.day_booking_cap) {                                                             // the daily limit is reached
      return {                                                                                                // stop here with an error
        ok: false,                                                                                            // not allowed
        status: 409,                                                                                          // conflict
        message: `The limit of ${rule.day_booking_cap} bookings for this day has been reached.`,              // error text
      };                                                                                                      // end of the error
    }                                                                                                         // end of limit check
  }                                                                                                           // end of daily cap block

  return { ok: true, rule, facility_type: fac.rows[0].type };                                                 // everything is fine, give back the rule and facility type
}                                                                                                             // end of validateSlot

// Shared input checks. Returns an error message, or null when the input is fine.
function checkSlotInput(date, start, end) {                                                                   // start of checkSlotInput
  if (!isValidDate(date) || !isValidTime(start) || !isValidTime(end))                                         // date or time looks wrong
    return 'Invalid date or time format';                                                                     // send error text
  if (toMin(end) <= toMin(start)) return 'End time must be after start time';                                 // end must come after start
  const now = bhutanNow();                                                                                    // current Bhutan date and time
  if (date < now.date || (date === now.date && toMin(start) <= now.minutes))                                  // the time is already in the past
    return 'That time has already passed';                                                                    // send error text
  return null;                                                                                                // null means the input is fine
}                                                                                                             // end of checkSlotInput

// ---------------------------------------------------------------
// C. ROUTES
// ---------------------------------------------------------------

// ---- POST /bookings : make a booking -------------------------------------
router.post('/', authenticate, async (req, res) => {                                                          // start of the make-a-booking route
  const { facility_id, booking_date, purpose } = req.body;                                                    // take these values from the request
  if (!facility_id || !booking_date || !req.body.start_time || !req.body.end_time) {                          // these four are compulsory
    return res                                                                                                // send error
      .status(400)                                                                                            // bad request
      .json({ error: 'facility_id, booking_date, start_time and end_time are required' });                    // error text
  }                                                                                                           // end of check
  const start = hhmm(req.body.start_time);                                                                    // clean start time to "HH:MM"
  const end = hhmm(req.body.end_time);                                                                        // clean end time to "HH:MM"
  const inputError = checkSlotInput(booking_date, start, end);                                                // check date and times
  if (inputError) return res.status(400).json({ error: inputError });                                         // input is wrong, send error

  const client = await pool.connect();                                                                        // get one connection for the transaction
  try {                                                                                                       // start of main work
    await client.query('BEGIN');                                                                              // start the transaction

    // One booking at a time PER FACILITY. The second of two simultaneous
    // requests waits here, then sees the first booking and gets a 409.
    // This is what guarantees zero double bookings (Objective O3).
    await client.query('SELECT pg_advisory_xact_lock(1001, $1::int)', [facility_id]);                         // lock this facility until we finish

    const slot = await validateSlot(client, {                                                                 // check all the slot rules
      facilityId: facility_id,                                                                                // which facility
      date: booking_date,                                                                                     // which date
      start,                                                                                                  // start time
      end,                                                                                                    // end time
    });                                                                                                       // end of validateSlot call
    if (!slot.ok) {                                                                                           // a slot rule failed
      await client.query('ROLLBACK');                                                                         // undo everything
      return res.status(slot.status).json({ error: slot.message });                                           // send the error
    }                                                                                                         // end of check

    const eligibility = checkEligibility(                                                                     // check if this user's role may book this slot
      req.user.role,                                                                                          // user's role
      slot.rule,                                                                                              // rule that covers the slot
      booking_date,                                                                                           // date
      start,                                                                                                  // start time
      req.user.gender,                                                                                        // user's gender
    );                                                                                                        // end of checkEligibility call
    if (!eligibility.ok) {                                                                                    // user is not allowed
      await client.query('ROLLBACK');                                                                         // undo everything
      return res.status(eligibility.status).json({ error: eligibility.message });                             // send the error
    }                                                                                                         // end of check

    // Commercial-rate slots require payment and approval, including
    // when a student is allowed to book one of those slots.
    // (A female student booking her own reserved slot is NOT a commercial booking.)
    const commercialSlot =                                                                                    // is this a commercial booking?
      slot.rule.primary_role === 'commercial' || eligibility.viaFallback === true;                            // commercial slot, or user got in through the fallback group
    const requiresPayment = req.user.role === 'outsider' || commercialSlot;                                   // outsiders and commercial bookings must pay
    let paymentAmount = null;                                                                                 // will hold the amount to pay
    let paymentJournalNumber = null;                                                                          // will hold the journal number
    let paymentScreenshot = null;                                                                             // will hold the screenshot
    if (requiresPayment) {                                                                                    // only check payment details when payment is needed
      paymentJournalNumber = req.body.payment_journal_number;                                                 // journal number typed by the user
      if (typeof paymentJournalNumber !== 'string' || !paymentJournalNumber.trim()) {                         // must be text and not empty
        await client.query('ROLLBACK');                                                                       // undo everything
        return res.status(400).json({ error: 'Enter the payment journal number.' });                          // send error
      }                                                                                                       // end of check
      if (paymentJournalNumber.trim().length > 100) {                                                         // journal number is too long
        await client.query('ROLLBACK');                                                                       // undo everything
        return res                                                                                            // send error
          .status(400)                                                                                        // bad request
          .json({ error: 'The journal number must be 100 characters or fewer.' });                            // error text
      }             
            // ----- block a journal number that was already used -----
      const journalKey = paymentJournalNumber.trim().toLowerCase();                                             // Clean version: no spaces, lowercase
      await client.query(                                                                                       // Lock this journal number, so two requests cannot use it together
        'SELECT pg_advisory_xact_lock(1002, hashtext($1))',                                                     // Lock number 1002 + the journal text
        [journalKey],                                                                                           // Value for $1
      );                                                                                                        // End of the lock query
      const duplicate = await client.query(                                                                     // Look for the same journal number in other bookings
        `SELECT 1 FROM bookings -- We only need to know if a row exists
         WHERE lower(trim(payment_journal_number)) = $1 -- Same number, ignoring spaces and case
           AND status IN ('pending', 'approved', 'expired') -- Cancelled ones are allowed to be reused
         LIMIT 1`,                                                                                              // Stop at the first match
        [journalKey],                                                                                           // Value for $1
      );                                                                                                        // End of the duplicate query
      if (duplicate.rows.length > 0) {                                                                          // The number was already used
        await client.query('ROLLBACK');                                                                         // Undo everything
        return res.status(400).json({ error: 'This journal number was already used for another booking.' });    // Tell the user
      }
                                                                                                               // End of the duplicate check                                                                                          // end of check
      const screenshotError = paymentScreenshotError(req.body.payment_screenshot);                            // check the screenshot
      if (screenshotError) {                                                                                  // screenshot is not fine
        await client.query('ROLLBACK');                                                                       // undo everything
        return res.status(400).json({ error: screenshotError });                                              // send error
      }                                                                                                       // end of check
      if (                                                                                                    // assistant_referees is optional, but must be true/false
        req.body.assistant_referees !== undefined &&                                                          // it was sent
        typeof req.body.assistant_referees !== 'boolean'                                                      // but it is not true/false
      ) {                                                                                                     // start of the block
        await client.query('ROLLBACK');                                                                       // undo everything
        return res.status(400).json({ error: 'assistant_referees must be a boolean.' });                      // send error
      }                                                                                                       // end of check
      paymentAmount = bookingPaymentAmount(                                                                   // work out the price
        slot.facility_type,                                                                                   // type of facility
        req.user.role,                                                                                        // user's role
        booking_date,                                                                                         // date (weekend costs more)
        req.body.assistant_referees === true,                                                                 // true only if the user asked for assistant referees
      );                                                                                                      // end of price calculation
      paymentJournalNumber = paymentJournalNumber.trim();                                                     // remove extra spaces
      paymentScreenshot = req.body.payment_screenshot;                                                        // keep the screenshot to save
    }                                                                                                         // end of payment block
    const initialStatus = requiresPayment ? 'pending' : 'approved';                                           // paid bookings wait for admin approval
    // SQL below: save the new booking
    const inserted = await client.query(                                                                      // run the query
      `INSERT INTO bookings (
         user_id, facility_id, booking_date, start_time, end_time, purpose, status,
         payment_amount, payment_journal_number, payment_screenshot
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, status, payment_amount, payment_journal_number`,
      [                                                                                                       // values for $1 to $10
        req.user.id,                                                                                          // $1 who booked
        facility_id,                                                                                          // $2 facility
        booking_date,                                                                                         // $3 date
        start,                                                                                                // $4 start time
        end,                                                                                                  // $5 end time
        purpose || null,                                                                                      // $6 purpose (or null)
        initialStatus,                                                                                        // $7 pending or approved
        paymentAmount,                                                                                        // $8 amount to pay
        paymentJournalNumber,                                                                                 // $9 journal number
        paymentScreenshot,                                                                                    // $10 screenshot
      ],                                                                                                      // end of values
    );                                                                                                        // end of query
    const notificationMessage =                                                                               // text for the notification
      initialStatus === 'pending'                                                                             // waiting for approval?
        // yes: tell the user it is pending
        ? `Your booking for ${booking_date} (${start}-${end}) is pending approval after payment verification.`
        : `Your booking for ${booking_date} (${start}-${end}) is confirmed.`;                                 // no: tell the user it is confirmed
    await addBookingNotification(                                                                             // save the notification
      client,                                                                                                 // same transaction
      req.user.id,                                                                                            // who gets it
      initialStatus === 'pending' ? 'booking_pending' : 'booking_confirmed',                                  // kind of notification
      notificationMessage,                                                                                    // the text
    );                                                                                                        // end of addBookingNotification

    await client.query('COMMIT');                                                                             // save everything permanently
    if (initialStatus === 'approved') {                                                                       // send the email only for confirmed bookings
      await sendBookingUpdateEmail(req.user.id, facility_id, {                                                // send the email
        subject: 'Booking confirmed - CST-SFBS',                                                              // email title
        statusMessage: 'Your booking is confirmed.',                                                          // message line
        bookingDate: booking_date,                                                                            // date
        startTime: start,                                                                                     // start time
        endTime: end,                                                                                         // end time
      });                                                                                                     // end of email
    }  
    if (requiresPayment) {                                                        // Only paid bookings need the admin to check payment
      // ----- get names for the admin email -----
      const who = await pool.query(                                               // Ask the database for booking details
        `SELECT u.full_name, u.email, u.role, u.contact_number, -- Who booked
                f.name AS facility_name -- Which facility
         FROM users u JOIN facilities f ON f.id = $2 -- Join user and facility
         WHERE u.id = $1`,                                                        // Only this user
        [req.user.id, facility_id],                                               // Values for $1 and $2
      );                                                                          // End of the query
      const w = who.rows[0] || {};                                                // The row, or an empty object
      // ----- send the alert (no await, so the user does not wait) -----
      notifyAdmins({                                                              // Email the admin(s)
        subject: `New paid booking to approve - BK-${inserted.rows[0].id}`,       // Mail title
        text:                                                                     // Mail body, joined from short lines
          'A commercial/outsider booking is waiting for your approval.\n\n' +     // Intro line
          `Booking: BK-${inserted.rows[0].id}\n` +                                // Booking number
          `Booked by: ${w.full_name} (${w.role}) - ${w.email}\n` +                // Name, role and email
          `Phone: ${w.contact_number || 'not given'}\n` +                         // Phone number
          `Facility: ${w.facility_name}\n` +                                      // Facility name
          `Date: ${booking_date}\n` +                                             // Booking date
          `Time: ${start}-${end}\n` +                                             // Start and end time
          `Amount: Nu. ${paymentAmount}\n` +                                      // Money to be paid
          `Journal number: ${paymentJournalNumber}\n\n` +                         // Payment reference
          'Open Admin > Bookings, check the screenshot and journal number, ' +    // What to do
          'then approve the booking once the payment is confirmed.',              // Last instruction
      });                                                                         // End of notifyAdmins
    }                                                                             // End of the requiresPayment check                                                                                                       // end of check
    res.status(201).json({                                                                                    // 201 = created, send the result
      booking: {                                                                                              // the new booking
        ...inserted.rows[0],                                                                                  // values saved in the database
        payment_account_number: requiresPayment ? PAYMENT_ACCOUNT_NUMBER : null,                              // show the account number only when payment is needed
      },                                                                                                      // end of booking
    });                                                                                                       // end of response
  } catch (err) {                                                                                             // if anything failed
    await client.query('ROLLBACK');                                                                           // undo changes
    if (err.code === '23505') return res.status(409).json({ error: CONFLICT_MESSAGE });                       // 23505 = duplicate in the database (last safety check)
    console.error(err);                                                                                       // show the error in console
    res.status(500).json({ error: 'Failed to create booking' });                                              // send general error
  } finally {                                                                                                 // always run this part
    client.release();                                                                                         // give the connection back
  }                                                                                                           // end of try/catch/finally
});                                                                                                           // end of the make-a-booking route

// ---- GET /bookings/user/:userId : "My Bookings" --------------------------
router.get('/user/:userId', authenticate, async (req, res) => {                                               // start of the My Bookings route
  const userId = Number(req.params.userId);                                                                   // user id from the link
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });                   // id must be a whole number
  if (userId !== req.user.id)                                                                                 // users can only see their own bookings
    return res.status(403).json({ error: 'You can only view your own bookings' });                            // send error
  try {                                                                                                       // start of main work
    // SQL below: get this user's bookings (hide old approved ones and archived ones)
    const result = await pool.query(                                                                          // run the query
      `SELECT b.id, b.status, b.purpose, b.facility_id,
              to_char(b.booking_date, 'YYYY-MM-DD') AS booking_date,
              to_char(b.start_time, 'HH24:MI') AS start_time,
              to_char(b.end_time, 'HH24:MI') AS end_time,
              f.name AS facility_name, b.payment_amount, b.payment_resolution,
              b.payment_resolution_completed_at
       FROM bookings b JOIN facilities f ON f.id = b.facility_id
       WHERE b.user_id = $1
         AND (b.status <> 'approved' OR b.booking_date >= $2::date - 7)
         AND NOT EXISTS (
           SELECT 1 FROM user_booking_archives a
           WHERE a.user_id = b.user_id AND a.booking_id = b.id
         )
       ORDER BY b.booking_date DESC, b.start_time DESC`,
      [userId, bhutanNow().date],                                                                             // values for $1 and $2 (today in Bhutan)
    );                                                                                                        // end of query
    res.json(result.rows);                                                                                    // send the bookings
  } catch (err) {                                                                                             // if anything failed
    console.error(err);                                                                                       // show the error in console
    res.status(500).json({ error: 'Failed to fetch your bookings' });                                         // send error
  }                                                                                                           // end of try/catch
});                                                                                                           // end of the My Bookings route

// ---- DELETE /bookings/:id/archive : hide an old completed booking from the owner's history
router.delete('/:id/archive', authenticate, async (req, res) => {                                             // start of the archive route
  const bookingId = Number(req.params.id);                                                                    // booking id from the link
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {                                                   // id must be a positive whole number
    return res.status(400).json({ error: 'Invalid booking id' });                                             // send error
  }                                                                                                           // end of check

  try {                                                                                                       // start of main work
    // SQL below: hide the booking (only if it is yours, approved and already in the past)
    const result = await pool.query(                                                                          // run the query
      `INSERT INTO user_booking_archives (user_id, booking_id)
       SELECT b.user_id, b.id
       FROM bookings b
       WHERE b.id = $1
         AND b.user_id = $2
         AND b.status = 'approved'
         AND b.booking_date < $3::date
       ON CONFLICT (user_id, booking_id)
       DO UPDATE SET archived_at = user_booking_archives.archived_at
       RETURNING booking_id`,
      [bookingId, req.user.id, bhutanNow().date],                                                             // values for $1 to $3 (today in Bhutan)
    );                                                                                                        // end of query
    if (result.rows.length === 0) {                                                                           // nothing was archived
      return res                                                                                              // send error
        .status(404)                                                                                          // not found
        .json({ error: 'Only your completed bookings can be removed from history' });                         // error text
    }                                                                                                         // end of check
    res.json({ bookingId: result.rows[0].booking_id, archived: true });                                       // tell the frontend it is hidden
  } catch (err) {                                                                                             // if anything failed
    console.error(err);                                                                                       // show the error in console
    res.status(500).json({ error: 'Failed to remove completed booking from history' });                       // send error
  }                                                                                                           // end of try/catch
});                                                                                                           // end of the archive route

// ---- PATCH /bookings/:id/cancel : a user cancels their OWN booking -------
router.patch('/:id/cancel', authenticate, async (req, res) => {                                               // start of the user-cancel route
  const bookingId = Number(req.params.id);                                                                    // booking id from the link
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {                                                   // id must be a positive whole number
    return res.status(400).json({ error: 'Invalid booking id' });                                             // send error
  }                                                                                                           // end of check

  const client = await pool.connect();                                                                        // get one connection for the transaction
  try {                                                                                                       // start of main work
    await client.query('BEGIN');                                                                              // start the transaction
    // SQL below: cancel the booking (only if it is yours and approved)
    const result = await client.query(                                                                        // run the query
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'approved'
       RETURNING id, user_id, facility_id, status,
                 to_char(booking_date, 'YYYY-MM-DD') AS booking_date,
                 to_char(start_time, 'HH24:MI') AS start_time,
                 to_char(end_time, 'HH24:MI') AS end_time`,
      [bookingId, req.user.id],                                                                               // values for $1 and $2
    );                                                                                                        // end of query
    if (result.rows.length === 0) {                                                                           // nothing was cancelled
      await client.query('ROLLBACK');                                                                         // undo everything
      return res.status(404).json({ error: 'Booking not found, not yours, or already cancelled' });           // send error
    }                                                                                                         // end of check

    const booking = result.rows[0];                                                                           // the cancelled booking
    await addBookingNotification(                                                                             // save a notification
      client,                                                                                                 // same transaction
      booking.user_id,                                                                                        // who gets it
      'booking_cancelled',                                                                                    // kind of notification
      // the text
      `Your booking for ${booking.booking_date} (${booking.start_time}-${booking.end_time}) was cancelled.`,
    );                                                                                                        // end of addBookingNotification

    await client.query('COMMIT');                                                                             // save everything permanently
    await sendBookingUpdateEmail(booking.user_id, booking.facility_id, {                                      // send the email
      subject: 'Booking cancelled - CST-SFBS',                                                                // email title
      statusMessage: 'Your booking was cancelled.',                                                           // message line
      bookingDate: booking.booking_date,                                                                      // date
      startTime: booking.start_time,                                                                          // start time
      endTime: booking.end_time,                                                                              // end time
    });                                                                                                       // end of email
    res.json({ booking: { id: booking.id, status: booking.status } });                                        // send the result
  } catch (err) {                                                                                             // if anything failed
    await client.query('ROLLBACK');                                                                           // undo changes
    console.error(err);                                                                                       // show the error in console
    res.status(500).json({ error: 'Failed to cancel booking' });                                              // send error
  } finally {                                                                                                 // always run this part
    client.release();                                                                                         // give the connection back
  }                                                                                                           // end of try/catch/finally
});                                                                                                           // end of the user-cancel route

// ---- GET /bookings : every booking (admin) -------------------------------
router.get('/', requireAdmin, async (req, res) => {                                                           // start of the all-bookings route (admin only)
  try {                                                                                                       // start of main work
    // SQL below: get every booking with user and facility details, newest first
    const result = await pool.query(                                                                          // run the query
      `SELECT b.id, b.status, b.purpose,
              b.created_at,
              to_char(b.booking_date, 'YYYY-MM-DD') AS booking_date,
              to_char(b.start_time, 'HH24:MI') AS start_time,
              to_char(b.end_time, 'HH24:MI') AS end_time,
              u.full_name AS user_name, u.role AS user_role, f.name AS facility_name,
              b.payment_amount, b.payment_journal_number,
              b.payment_screenshot IS NOT NULL AS has_payment_proof,
              b.payment_verified_at, b.payment_resolution,
              b.payment_resolution_completed_at
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN facilities f ON f.id = b.facility_id
       ORDER BY b.created_at DESC, b.id DESC`,
    );                                                                                                        // end of query
    res.json(result.rows);                                                                                    // send all bookings
  } catch (err) {                                                                                             // if anything failed
    console.error(err);                                                                                       // show the error in console
    res.status(500).json({ error: 'Failed to fetch bookings' });                                              // send error
  }                                                                                                           // end of try/catch
});                                                                                                           // end of the all-bookings route

// ---- GET /bookings/:id/payment-proof : admin sees the payment proof ------
router.get('/:id/payment-proof', requireAdmin, async (req, res) => {                                          // start of the payment-proof route (admin only)
  const bookingId = Number(req.params.id);                                                                    // booking id from the link
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {                                                   // id must be a positive whole number
    return res.status(400).json({ error: 'Invalid booking id' });                                             // send error
  }                                                                                                           // end of check
  try {                                                                                                       // start of main work
    // SQL below: get the payment details of this booking
    const result = await pool.query(                                                                          // run the query
      `SELECT payment_amount, payment_journal_number, payment_screenshot, payment_verified_at
       FROM bookings WHERE id = $1`,
      [bookingId],                                                                                            // value for $1
    );                                                                                                        // end of query
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });                // no such booking
    const proof = result.rows[0];                                                                             // the payment details
    if (!proof.payment_screenshot || !proof.payment_journal_number) {                                         // user never sent proof
      return res.status(404).json({ error: 'Payment proof was not submitted for this booking.' });            // send error
    }                                                                                                         // end of check
    res.json(proof);                                                                                          // send the payment details
  } catch (err) {                                                                                             // if anything failed
    console.error(err);                                                                                       // show the error in console
    res.status(500).json({ error: 'Failed to fetch payment proof' });                                         // send error
  }                                                                                                           // end of try/catch
});                                                                                                           // end of the payment-proof route

// ---- PATCH /bookings/:id/payment-resolution : refund / credit for an expired paid booking
// user chooses refund or credit; admin marks it as done
router.patch('/:id/payment-resolution', authenticate, async (req, res) => {                                   // start of the payment-resolution route
  const bookingId = Number(req.params.id);                                                                    // booking id from the link
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {                                                   // id must be a positive whole number
    return res.status(400).json({ error: 'Invalid booking id' });                                             // send error
  }                                                                                                           // end of check

  const client = await pool.connect();                                                                        // get one connection for the transaction
  try {                                                                                                       // start of main work
    await client.query('BEGIN');                                                                              // start the transaction
    let result;                                                                                               // will hold the update result
    if (req.user.role === 'admin') {                                                                          // case 1: admin marks the remedy as done
      if (req.body.completed !== true) {                                                                      // admin must confirm
        await client.query('ROLLBACK');                                                                       // undo everything
        return res.status(400).json({ error: 'Admin completion must be confirmed.' });                        // send error
      }                                                                                                       // end of check
      // SQL below: mark the refund/credit as completed
      result = await client.query(                                                                            // run the query
        `UPDATE bookings
         SET payment_resolution_completed_at = now()
         WHERE id = $1 AND status = 'expired' AND payment_amount IS NOT NULL
           AND payment_resolution IS NOT NULL AND payment_resolution_completed_at IS NULL
         RETURNING id, user_id, payment_resolution, payment_resolution_completed_at`,
        [bookingId],                                                                                          // value for $1
      );                                                                                                      // end of query
    } else {                                                                                                  // case 2: the user chooses refund or credit
      const { resolution } = req.body;                                                                        // the user's choice
      if (!['refund', 'credit'].includes(resolution)) {                                                       // must be refund or credit
        await client.query('ROLLBACK');                                                                       // undo everything
        return res.status(400).json({ error: 'Choose either a refund or booking credit.' });                  // send error
      }                                                                                                       // end of check
      // SQL below: save the user's choice (only for their own expired paid booking)
      result = await client.query(                                                                            // run the query
        `UPDATE bookings
         SET payment_resolution = $3
         WHERE id = $1 AND user_id = $2 AND status = 'expired'
           AND payment_amount IS NOT NULL AND payment_resolution_completed_at IS NULL
         RETURNING id, payment_resolution, payment_resolution_completed_at`,
        [bookingId, req.user.id, resolution],                                                                 // values for $1 to $3
      );                                                                                                      // end of query
    }                                                                                                         // end of admin / user cases

    if (result.rows.length === 0) {                                                                           // nothing was updated
      await client.query('ROLLBACK');                                                                         // undo everything
      return res.status(404).json({                                                                           // send error
        error:                                                                                                // error text
          req.user.role === 'admin'                                                                           // different text for admin and user
            ? 'An outstanding payment remedy with a user choice was not found.'                               // admin text
            : 'No eligible expired paid booking was found.',                                                  // user text
      });                                                                                                     // end of the error
    }                                                                                                         // end of check

    const booking = result.rows[0];                                                                           // the updated booking
    if (req.user.role === 'admin') {                                                                          // tell the user the admin finished it
      await addBookingNotification(                                                                           // save a notification
        client,                                                                                               // same transaction
        booking.user_id,                                                                                      // who gets it
        'payment_resolution_completed',                                                                       // kind of notification
        booking.payment_resolution === 'refund'                                                               // refund or credit?
          ? `The DSA has marked the full refund for booking B-${booking.id} as processed.`                    // refund text
          : `The DSA has marked the booking credit for booking B-${booking.id} as issued.`,                   // credit text
      );                                                                                                      // end of addBookingNotification
    } else {                                                                                                  // tell the user their request was sent
      await addBookingNotification(                                                                           // save a notification
        client,                                                                                               // same transaction
        req.user.id,                                                                                          // who gets it
        'payment_resolution_requested',                                                                       // kind of notification
        booking.payment_resolution === 'refund'                                                               // refund or credit?
          ? `Your full-refund request for expired booking B-${booking.id} has been sent to the DSA.`          // refund text
          : `Your booking-credit request for expired booking B-${booking.id} has been sent to the DSA.`,      // credit text
      );                                                                                                      // end of addBookingNotification
    }                                                                                                         // end of notification cases
    await client.query('COMMIT');                                                                             // save everything permanently
    res.json({ booking });                                                                                    // send the result
  } catch (err) {                                                                                             // if anything failed
    await client.query('ROLLBACK');                                                                           // undo changes
    console.error(err);                                                                                       // show the error in console
    res.status(500).json({ error: 'Failed to update payment remedy' });                                       // send error
  } finally {                                                                                                 // always run this part
    client.release();                                                                                         // give the connection back
  }                                                                                                           // end of try/catch/finally
});                                                                                                           // end of the payment-resolution route

// ---- PATCH /bookings/:id : admin approves a pending booking, or cancels any --
// status 'approved'  -> pending paid booking after proof review
// status 'cancelled' -> exception handling (no-shows, rule violations, closures)
router.patch('/:id', requireAdmin, async (req, res) => {                                                      // start of the admin approve / cancel route
  const { status, reason } = req.body;                                                                        // new status and the cancel reason

  // Approve a pending paid booking only after payment proof has been submitted.
  if (status === 'approved') {                                                                                // ----- PART 1: approve a pending booking -----
    const bookingId = Number(req.params.id);                                                                  // booking id from the link
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {                                                 // id must be a positive whole number
      return res.status(400).json({ error: 'Invalid booking id' });                                           // send error
    }                                                                                                         // end of check
    const client = await pool.connect();                                                                      // get one connection for the transaction
    try {                                                                                                     // start of main work
      await client.query('BEGIN');                                                                            // start the transaction
      // SQL below: approve the booking (only if pending, paid with proof, and not started yet)
      const result = await client.query(                                                                      // run the query
        `UPDATE bookings
         SET status = 'approved', payment_verified_at = now()
         WHERE id = $1 AND status = 'pending'
           AND payment_amount IS NOT NULL
           AND payment_journal_number IS NOT NULL
           AND payment_screenshot IS NOT NULL
           AND ((booking_date + start_time) AT TIME ZONE 'Asia/Thimphu') > now()
         RETURNING id, user_id, facility_id, to_char(booking_date,'YYYY-MM-DD') AS booking_date,
                   to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time`,
        [bookingId],                                                                                          // value for $1
      );                                                                                                      // end of query
      if (result.rows.length === 0) {                                                                         // nothing was approved, find out why
        // SQL below: if the start time already passed, mark the pending booking as expired
        const expired = await client.query(                                                                   // run the query
          `UPDATE bookings SET status = 'expired' WHERE id = $1 AND status = 'pending'
             AND ((booking_date + start_time) AT TIME ZONE 'Asia/Thimphu') <= now()
           RETURNING id, user_id, facility_id, booking_date, start_time, payment_amount,
                     payment_screenshot`,
          [bookingId],                                                                                        // value for $1
        );                                                                                                    // end of query
        if (expired.rowCount > 0) {                                                                           // the booking just expired
          const expiredBooking = expired.rows[0];                                                             // the expired booking
          if (expiredBooking.payment_amount && expiredBooking.payment_screenshot) {                           // user had already paid
            await addBookingNotification(                                                                     // tell the user to choose refund or credit
              client,                                                                                         // same transaction
              expiredBooking.user_id,                                                                         // who gets it
              'payment_resolution_required',                                                                  // kind of notification
              // the text
              'Your paid booking was not approved before it started and has expired. Choose a full refund or booking credit in My Bookings. The DSA will arrange your choice.',
            );                                                                                                // end of addBookingNotification
          }                                                                                                   // end of paid check
          await client.query('COMMIT');                                                                       // save the expiry permanently
          return res.status(410).json({                                                                       // 410 = gone, send error
            error: 'This pending booking has expired because its start time has passed.',                     // error text
          });                                                                                                 // end of the error
        }                                                                                                     // end of expired block
        await client.query('ROLLBACK');                                                                       // nothing to save, undo
        // SQL below: look at the pending booking to see what is missing
        const pending = await client.query(                                                                   // run the query
          `SELECT payment_amount, payment_screenshot, payment_journal_number
           FROM bookings WHERE id = $1 AND status = 'pending'`,
          [bookingId],                                                                                        // value for $1
        );                                                                                                    // end of query
        if (                                                                                                  // is some payment detail missing?
          pending.rows.length > 0 &&                                                                          // the booking is pending
          (!pending.rows[0].payment_amount ||                                                                 // and the amount is missing
            !pending.rows[0].payment_screenshot ||                                                            // or the screenshot is missing
            !pending.rows[0].payment_journal_number)                                                          // or the journal number is missing
        ) {                                                                                                   // start of the block
          return res                                                                                          // send error
            .status(400)                                                                                      // bad request
            .json({ error: 'Payment proof must be submitted before approval.' });                             // error text
        }                                                                                                     // end of check
        return res                                                                                            // send error
          .status(404)                                                                                        // not found
          .json({ error: 'Pending booking not found (it may already be approved or cancelled)' });            // error text
      }                                                                                                       // end of "find out why" block
      const b = result.rows[0];                                                                               // the approved booking
      await addBookingNotification(                                                                           // save a notification
        client,                                                                                               // same transaction
        b.user_id,                                                                                            // who gets it
        'booking_confirmed',                                                                                  // kind of notification
        `Your booking for ${b.booking_date} (${b.start_time}-${b.end_time}) was approved.`,                   // the text
      );                                                                                                      // end of addBookingNotification
      await client.query('COMMIT');                                                                           // save everything permanently
      await sendBookingUpdateEmail(b.user_id, b.facility_id, {                                                // send the email
        subject: 'Booking approved - CST-SFBS',                                                               // email title
        statusMessage: 'Your booking has been approved.',                                                     // message line
        bookingDate: b.booking_date,                                                                          // date
        startTime: b.start_time,                                                                              // start time
        endTime: b.end_time,                                                                                  // end time
      });                                                                                                     // end of email
      return res.json({ booking: { id: b.id, status: 'approved' } });                                         // send the result
    } catch (err) {                                                                                           // if anything failed
      await client.query('ROLLBACK');                                                                         // undo changes
      console.error(err);                                                                                     // show the error in console
      return res.status(500).json({ error: 'Failed to approve booking' });                                    // send error
    } finally {                                                                                               // always run this part
      client.release();                                                                                       // give the connection back
    }                                                                                                         // end of try/catch/finally
  }                                                                                                           // end of PART 1 (approve)

  if (status !== 'cancelled')                                                                                 // ----- PART 2: cancel a booking -----
    return res.status(400).json({ error: "status must be 'approved' or 'cancelled'" });                       // only these two statuses are allowed
  if (typeof reason !== 'string' || !reason.trim()) {                                                         // a reason is compulsory
    return res.status(400).json({ error: 'A cancellation reason is required' });                              // send error
  }                                                                                                           // end of check
  const client = await pool.connect();                                                                        // get one connection for the transaction
  try {                                                                                                       // start of main work
    await client.query('BEGIN');                                                                              // start the transaction
    // SQL below: cancel the booking (if it is not already cancelled)
    const result = await client.query(                                                                        // run the query
      `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status <> 'cancelled'
       RETURNING id, user_id, facility_id, to_char(booking_date,'YYYY-MM-DD') AS booking_date,
                 to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time`,
      [req.params.id],                                                                                        // value for $1
    );                                                                                                        // end of query
    if (result.rows.length === 0) {                                                                           // nothing was cancelled
      await client.query('ROLLBACK');                                                                         // undo everything
      return res.status(404).json({ error: 'Booking not found or already cancelled' });                       // send error
    }                                                                                                         // end of check

    const b = result.rows[0];                                                                                 // the cancelled booking
    await addBookingNotification(                                                                             // save a notification
      client,                                                                                                 // same transaction
      b.user_id,                                                                                              // who gets it
      'booking_cancelled',                                                                                    // kind of notification
      // the text with the reason
      `Your booking for ${b.booking_date} (${b.start_time}-${b.end_time}) was cancelled by an admin. Reason: ${reason.trim()}`,
    );                                                                                                        // end of addBookingNotification
    await client.query('COMMIT');                                                                             // save everything permanently
    await sendBookingUpdateEmail(b.user_id, b.facility_id, {                                                  // send the email
      subject: 'Booking cancelled - CST-SFBS',                                                                // email title
      statusMessage: 'Your booking was cancelled by an admin.',                                               // message line
      bookingDate: b.booking_date,                                                                            // date
      startTime: b.start_time,                                                                                // start time
      endTime: b.end_time,                                                                                    // end time
      reason: reason.trim(),                                                                                  // why it was cancelled
    });                                                                                                       // end of email
    res.json({ booking: { id: b.id, status: 'cancelled' } });                                                 // send the result
  } catch (err) {                                                                                             // if anything failed
    await client.query('ROLLBACK');                                                                           // undo changes
    console.error(err);                                                                                       // show the error in console
    res.status(500).json({ error: 'Failed to cancel booking' });                                              // send error
  } finally {                                                                                                 // always run this part
    client.release();                                                                                         // give the connection back
  }                                                                                                           // end of try/catch/finally
});                                                                                                           // end of the admin approve / cancel route

// ---- PATCH /bookings/:id/reschedule-request : owner moves own booking ----
router.patch('/:id/reschedule-request', authenticate, async (req, res) => {                                   // start of the user-reschedule route
  const { booking_date, reason } = req.body;                                                                  // new date and the reason
  if (!booking_date || !req.body.start_time || !req.body.end_time) {                                          // date and both times are compulsory
    return res.status(400).json({ error: 'booking_date, start_time and end_time are required' });             // send error
  }                                                                                                           // end of check
  if (typeof reason !== 'string' || !reason.trim()) {                                                         // a reason is compulsory
    return res.status(400).json({ error: 'A reason for rescheduling is required' });                          // send error
  }                                                                                                           // end of check
  if (reason.trim().length > 500) {                                                                           // reason is too long
    return res                                                                                                // send error
      .status(400)                                                                                            // bad request
      .json({ error: 'The rescheduling reason must be 500 characters or fewer' });                            // error text
  }                                                                                                           // end of check
  const start = hhmm(req.body.start_time);                                                                    // clean start time to "HH:MM"
  const end = hhmm(req.body.end_time);                                                                        // clean end time to "HH:MM"
  const inputError = checkSlotInput(booking_date, start, end);                                                // check date and times
  if (inputError) return res.status(400).json({ error: inputError });                                         // input is wrong, send error

  const client = await pool.connect();                                                                        // get one connection for the transaction
  try {                                                                                                       // start of main work
    await client.query('BEGIN');                                                                              // start the transaction

    // SQL below: find the user's own approved booking and lock the row
    const existing = await client.query(                                                                      // run the query
      `SELECT id, user_id, facility_id FROM bookings
       WHERE id = $1 AND user_id = $2 AND status = 'approved' FOR UPDATE`,
      [req.params.id, req.user.id],                                                                           // values for $1 and $2
    );                                                                                                        // end of query
    if (existing.rows.length === 0) {                                                                         // no such booking
      await client.query('ROLLBACK');                                                                         // undo everything
      return res.status(404).json({ error: 'Upcoming confirmed booking not found' });                         // send error
    }                                                                                                         // end of check
    const booking = existing.rows[0];                                                                         // the booking to move

    await client.query('SELECT pg_advisory_xact_lock(1001, $1::int)', [booking.facility_id]);                 // lock this facility until we finish

    const slot = await validateSlot(client, {                                                                 // check all the slot rules for the new time
      facilityId: booking.facility_id,                                                                        // same facility
      date: booking_date,                                                                                     // new date
      start,                                                                                                  // new start time
      end,                                                                                                    // new end time
      excludeBookingId: booking.id,                                                                           // ignore this booking itself when looking for overlaps
    });                                                                                                       // end of validateSlot call
    if (!slot.ok) {                                                                                           // a slot rule failed
      await client.query('ROLLBACK');                                                                         // undo everything
      return res.status(slot.status).json({ error: slot.message });                                           // send the error
    }                                                                                                         // end of check

    const eligibility = checkEligibility(                                                                     // check if this user's role may book the new slot
      req.user.role,                                                                                          // user's role
      slot.rule,                                                                                              // rule that covers the new slot
      booking_date,                                                                                           // new date
      start,                                                                                                  // new start time
      req.user.gender,                                                                                        // user's gender
    );                                                                                                        // end of checkEligibility call
    if (!eligibility.ok) {                                                                                    // user is not allowed
      await client.query('ROLLBACK');                                                                         // undo everything
      return res.status(eligibility.status).json({ error: eligibility.message });                             // send the error
    }                                                                                                         // end of check

    // SQL below: move the booking to the new date and time
    await client.query(                                                                                       // run the query
      'UPDATE bookings SET booking_date = $1, start_time = $2, end_time = $3 WHERE id = $4',
      [booking_date, start, end, booking.id],                                                                 // values for $1 to $4
    );                                                                                                        // end of query
    await addBookingNotification(                                                                             // save a notification
      client,                                                                                                 // same transaction
      booking.user_id,                                                                                        // who gets it
      'booking_rescheduled',                                                                                  // kind of notification
      `Your booking was rescheduled to ${booking_date} (${start}-${end}). Reason: ${reason.trim()}`,          // the text with the reason
    );                                                                                                        // end of addBookingNotification
    await client.query('COMMIT');                                                                             // save everything permanently
    await sendBookingUpdateEmail(booking.user_id, booking.facility_id, {                                      // send the email
      subject: 'Booking rescheduled - CST-SFBS',                                                              // email title
      statusMessage: 'Your booking was rescheduled.',                                                         // message line
      bookingDate: booking_date,                                                                              // new date
      startTime: start,                                                                                       // new start time
      endTime: end,                                                                                           // new end time
      reason: reason.trim(),                                                                                  // why it was moved
    });                                                                                                       // end of email
    res.json({ booking: { id: booking.id, booking_date, start_time: start, end_time: end } });                // send the new details
  } catch (err) {                                                                                             // if anything failed
    await client.query('ROLLBACK');                                                                           // undo changes
    if (err.code === '23505') return res.status(409).json({ error: CONFLICT_MESSAGE });                       // 23505 = duplicate in the database (last safety check)
    console.error(err);                                                                                       // show the error in console
    res.status(500).json({ error: 'Failed to reschedule booking' });                                          // send error
  } finally {                                                                                                // always run this part
    client.release();                                                                                         // give the connection back
  }                                                                                                           // end of try/catch/finally
});                                                                                                           // end of the user-reschedule route

// ---- PATCH /bookings/:id/reschedule : admin moves any booking -------------
// Same safety rules as a new booking (rule exists, not maintenance, no
// overlap, length limit) — an admin can move a booking but cannot create a
// double booking.
router.patch('/:id/reschedule', requireAdmin, async (req, res) => {                                           // start of the admin-reschedule route
  const { booking_date } = req.body;                                                                          // new date
  if (!booking_date || !req.body.start_time || !req.body.end_time) {                                          // date and both times are compulsory
    return res.status(400).json({ error: 'booking_date, start_time and end_time are required' });             // send error
  }            // end of check
  const start = hhmm(req.body.start_time);                                           // clean start time to "HH:MM"
  const end = hhmm(req.body.end_time);                                               // clean end time to "HH:MM"
  const inputError = checkSlotInput(booking_date, start, end);                       // check date and times
  if (inputError) return res.status(400).json({ error: inputError });                // input is wrong, send error

  const client = await pool.connect();        // get one connection for the transaction
  try {               // start of main work
    await client.query('BEGIN');              // start the transaction

    // SQL below: find any booking that is not cancelled or expired and lock the row
    const existing = await client.query(             // run the query
      `SELECT id, user_id, facility_id FROM bookings
       WHERE id = $1 AND status NOT IN ('cancelled', 'expired') FOR UPDATE`,
      [req.params.id],            // value for $1
    );          // end of query
    if (existing.rows.length === 0) {          // no such booking
      await client.query('ROLLBACK');          // undo everything
      return res.status(404).json({ error: 'Booking not found or already cancelled' });         // send error
    }         // end of check
    const booking = existing.rows[0];          // the booking to move

    await client.query('SELECT pg_advisory_xact_lock(1001, $1::int)', [booking.facility_id]);           // lock this facility until we finish

    const slot = await validateSlot(client, {           // check all the slot rules for the new time
      facilityId: booking.facility_id,         // same facility
      date: booking_date,                      // new date
      start,                                   // new start time
      end,                                     // new end time
      excludeBookingId: booking.id,            // ignore this booking itself when looking for overlaps
    });            // end of validateSlot call
    if (!slot.ok) {                                 // a slot rule failed
      await client.query('ROLLBACK');               // undo everything
      return res.status(slot.status).json({ error: slot.message });            // send the error
    }                              // end of check
    if (slot.rule.primary_role === 'maintenance') {        // admin also cannot move it into a maintenance slot
      await client.query('ROLLBACK');                      // undo everything
      return res                   // send error
        .status(400)               // bad request
        .json({ error: 'That time is reserved for maintenance / college team practice' });                    // error text
    }           // end of check

    // SQL below: move the booking to the new date and time
    await client.query(                     // run the query
      'UPDATE bookings SET booking_date = $1, start_time = $2, end_time = $3 WHERE id = $4',
      [booking_date, start, end, booking.id],          // values for $1 to $4
    );          // end of query
    await addBookingNotification(           // save a notification
      client,                               // same transaction
      booking.user_id,                      // who gets it
      'booking_rescheduled',                // kind of notification
      `Your booking was moved by an admin to ${booking_date} (${start}-${end}).`,          // the text
    );          // end of addBookingNotification
    await client.query('COMMIT');        // save everything permanently
    await sendBookingUpdateEmail(booking.user_id, booking.facility_id, {        // send the email
      subject: 'Booking rescheduled - CST-SFBS',                         // email title
      statusMessage: 'Your booking was moved by an admin.',              // message line
      bookingDate: booking_date,         // new date
      startTime: start,                  // new start time
      endTime: end,                      // new end time
    });                                  // end of email
    res.json({ booking: { id: booking.id, booking_date, start_time: start, end_time: end } });                // send the new details
  } catch (err) {                                      // if anything failed
    await client.query('ROLLBACK');                    // undo changes
    if (err.code === '23505') return res.status(409).json({ error: CONFLICT_MESSAGE });         // 23505 = duplicate in the database (last safety check)
    console.error(err);                                                         // show the error in console
    res.status(500).json({ error: 'Failed to reschedule booking' });            // send error
  } finally {                    // always run this part
    client.release();            // give the connection back
  }                              // end of try/catch/finally
});                              // end of the admin-reschedule route

module.exports = router;                // export the router so the main app can use these routes
