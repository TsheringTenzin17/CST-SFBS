// =============================================================
// Backend/src/time.js  —  "what time is it in Bhutan?"
// =============================================================
// Why this file exists: a server on Render runs in UTC, which is 6 hours
// behind Bhutan. Using new Date() directly would make "today" and
// "1 hour before the slot" wrong on the deployed site. Every place in the
// backend that needs "now" must call bhutanNow() instead.

const TZ = 'Asia/Thimphu';
const WINDOW_MODE = 'current'; // 'current' | 'next' | 'both'

function bookingWindow() {
  const today = bhutanNow().date;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // this Monday
  const add = (n) => { const x = new Date(d); x.setUTCDate(d.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const to = WINDOW_MODE === 'both' ? add(13) : WINDOW_MODE === 'next' ? add(13) : add(6);
  const from = WINDOW_MODE === 'next' ? add(7) : today;
  return { from, to, nextOpens: add(7) }; // next week opens Monday 00:00 Bhutan time
}

// Returns { date: 'YYYY-MM-DD', minutes: minutes since midnight } in Bhutan time.
function bhutanNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type).value;
  const hour = Number(get('hour')) % 24; // some engines print midnight as "24"
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
  };
}

// 'HH:MM' or 'HH:MM:SS'  ->  minutes since midnight
function toMin(t) {
  const [h, m] = String(t).split(':');
  return Number(h) * 60 + Number(m);
}

// Normalise 'HH:MM:SS' -> 'HH:MM'
function hhmm(t) {
  return String(t).slice(0, 5);
}

// 'YYYY-MM-DD' -> 0 (Sunday) ... 6 (Saturday). Uses UTC on purpose so the
// answer never depends on which timezone the server is in.
function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const isValidTime = (s) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(s));

module.exports = { bhutanNow, toMin, hhmm, dayOfWeek, isValidDate, isValidTime };