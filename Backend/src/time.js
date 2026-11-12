// =============================================================
// Backend/src/time.js  —  "what time is it in Bhutan?"
// =============================================================
// Why this file exists: a server on Render runs in UTC, which is 6 hours
// behind Bhutan. Using new Date() directly would make "today" and
// "1 hour before the slot" wrong on the deployed site. Every place in the
// backend that needs "now" must call bhutanNow() instead.

// ==============================================================
// SETTINGS - the time zone we use everywhere
// ==============================================================
const TZ = 'Asia/Thimphu';                                  // bhutan time zone name

// ==============================================================
// bookingWindow - which dates can be booked right now
// ==============================================================
function bookingWindow() {                                  // gives back from, to, nextOpens
  // ----------------------------------------------------------
  // find this monday
  // ----------------------------------------------------------
  const today = bhutanNow().date;                           // today in bhutan
  const d = new Date(`${today}T00:00:00Z`);                 // today at midnight utc
  // go back to monday (sunday is 0 so it needs the + 6)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // this Monday
  // ----------------------------------------------------------
  // helper to add days to monday
  // ----------------------------------------------------------
  const add = (n) => {                                      // n is number of days to add
    const x = new Date(d);                                  // copy monday
    x.setUTCDate(d.getUTCDate() + n);                       // move forward n days
    return x.toISOString().slice(0, 10);                    // give back YYYY-MM-DD
  };                                                        // end of add
  // ----------------------------------------------------------
  // work out the last bookable day
  // ----------------------------------------------------------
  // true if today is sunday in bhutan
  const isSunday = bhutanNow().minutes >= 0 && new Date(`${today}T00:00:00Z`).getUTCDay() === 0;
  const to = isSunday ? add(13) : add(6);                   // sunday sees 2 weeks, else this week
  // give back the window
  return { from: today, to, nextOpens: add(7) }; // Next week opens on Sunday at Bhutan midnight.
}                                                           // end of function

// ==============================================================
// bhutanNow - the date and time right now in bhutan
// ==============================================================
// Returns { date: 'YYYY-MM-DD', minutes: minutes since midnight } in Bhutan time.
function bhutanNow() {                                      // no input needed
  // ----------------------------------------------------------
  // ask the system for the bhutan time parts
  // ----------------------------------------------------------
  const parts = new Intl.DateTimeFormat('en-CA', {          // en-CA gives YYYY-MM-DD order
    timeZone: TZ,                                           // use bhutan time
    year: 'numeric',                                        // full year
    month: '2-digit',                                       // month with 2 digits
    day: '2-digit',                                         // day with 2 digits
    hour: '2-digit',                                        // hour with 2 digits
    minute: '2-digit',                                      // minute with 2 digits
    hour12: false,                                          // use 24 hour clock
  }).formatToParts(new Date());                             // split the time now into parts

  // ----------------------------------------------------------
  // build the answer
  // ----------------------------------------------------------
  // small helper to get one part by its name
  const get = (type) => parts.find((p) => p.type === type).value;
  // keep the original note about midnight below
  const hour = Number(get('hour')) % 24; // some engines print midnight as "24"
  return {                                                  // give back an object
    date: `${get('year')}-${get('month')}-${get('day')}`,   // date text YYYY-MM-DD
    minutes: hour * 60 + Number(get('minute')),             // minutes since midnight
  };                                                        // end of object
}                                                           // end of function

// ==============================================================
// toMin - turn a time text into minutes
// ==============================================================
// 'HH:MM' or 'HH:MM:SS'  ->  minutes since midnight
function toMin(t) {                                         // t is the time text
  const [h, m] = String(t).split(':');                      // split into hour and minute
  return Number(h) * 60 + Number(m);                        // hours to minutes plus minutes
}                                                           // end of function

// ==============================================================
// hhmm - cut a time text down to HH:MM
// ==============================================================
// Normalise 'HH:MM:SS' -> 'HH:MM'
function hhmm(t) {                                          // t is the time text
  return String(t).slice(0, 5);                             // keep the first 5 letters
}                                                           // end of function

// ==============================================================
// dayOfWeek - which day of the week is a date
// ==============================================================
// 'YYYY-MM-DD' -> 0 (Sunday) ... 6 (Saturday). Uses UTC on purpose so the
// answer never depends on which timezone the server is in.
function dayOfWeek(dateStr) {                               // dateStr is YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();      // 0 is sunday, 6 is saturday
}                                                           // end of function

// ==============================================================
// isPastDayStartRelease - has the early slot opened to outsiders
// ==============================================================
// Wednesday football rule (female students first):
// female students have first claim until 12:00 AM (Bhutan) on the booking date.
// From 12:05 AM that day the slot opens to commercial users / outsiders.
// keep the original note about 00:05 below
const RELEASE_AFTER_MINUTES = 5; // 00:05
function isPastDayStartRelease(bookingDate) {               // bookingDate is YYYY-MM-DD
  const now = bhutanNow();                                  // get bhutan time now
  if (now.date > bookingDate) return true;                  // booking day already passed
  // true if it is the booking day and 5 minutes after midnight
  return now.date === bookingDate && now.minutes >= RELEASE_AFTER_MINUTES;
}                                                           // end of function

// ==============================================================
// isPastWeeklyRelease - has the thursday slot been released
// ==============================================================
// now can be sent in, else we use the bhutan time now
function isPastWeeklyRelease(bookingDate, now = bhutanNow()) {
  if (dayOfWeek(bookingDate) !== 4) return false;           // only thursday has this rule

  // ----------------------------------------------------------
  // find the day before the booking
  // ----------------------------------------------------------
  // booking date at midnight utc
  const releaseDate = new Date(`${bookingDate}T00:00:00Z`);
  releaseDate.setUTCDate(releaseDate.getUTCDate() - 1);     // go back one day
  // turn that day into YYYY-MM-DD
  const releaseDateString = releaseDate.toISOString().slice(0, 10);
  // ----------------------------------------------------------
  // check if it is past 8 PM that day
  // ----------------------------------------------------------
  // true if that day is over, or it is that day and 8 PM (20 x 60 minutes) or later
  return now.date > releaseDateString || (now.date === releaseDateString && now.minutes >= 20 * 60);
}                                                           // end of function

// ==============================================================
// VALIDATORS - check if a date or time text is good
// ==============================================================
const isValidDate = (s) =>                                  // checks a date text
  // must look like YYYY-MM-DD and be a real date
  /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
// must look like HH:MM or HH:MM:SS with valid hour and minute
const isValidTime = (s) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(s));

// ==============================================================
// EXPORT - let other files use these functions
// ==============================================================
module.exports = {                                          // share the functions
  bhutanNow,                                                // date and time in bhutan
  bookingWindow,                                            // dates that can be booked
  isPastDayStartRelease,                                    // early slot release check
  isPastWeeklyRelease,                                      // thursday release check
  toMin,                                                    // time text to minutes
  hhmm,                                                     // cut time to HH:MM
  dayOfWeek,                                                // day number of a date
  isValidDate,                                              // check date text
  isValidTime,                                              // check time text
};                                                          // end of exports
