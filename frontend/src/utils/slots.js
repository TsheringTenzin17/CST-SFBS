// =============================================================
// frontend/src/utils/slots.js  —  turning rules into bookable slots
// =============================================================
// Shared by the availability page (Lhamo) and the booking conflict
// screen (Samdrup). The backend is the real judge of every booking;
// these helpers only decide what to SHOW (green / red / grey).
//
// Sections:  1. labels   2. time helpers   3. who can book   4. building slots
//            5. slot state   6. alternatives

// ---------- 1. labels ----------
export const ROLE_LABELS = {
  student: 'Students (free)',
  faculty: 'Faculty / Staff',
  student_female: 'Female students',
  faculty_male: 'Male faculty',
  faculty_female: 'Female faculty',
  commercial: 'Commercial (paid, all roles)',
  maintenance: 'Maintenance / college team',
  any: 'Students or commercial (first to book)',
  everyone: 'Students, faculty/staff, and outsiders',
};

export const STATE_LABELS = {
  maintenance: 'Closed for maintenance',
  past: 'Passed',
  unavailable: 'Not bookable',
  booked: 'Booked',
  full: 'Daily limit reached',
  restricted: 'Not for your role',
  open: 'Available',
};

// ---------- 2. time helpers ----------
export const toMin = (t) => {
  const [h, m] = String(t).split(':');
  return Number(h) * 60 + Number(m);
};
export const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Today as 'YYYY-MM-DD' in the browser's own (Bhutan) time.
const bhutanDateTimeParts = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Thimphu',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).formatToParts(new Date());

export const todayString = () => {
  const parts = bhutanDateTimeParts();
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const nowMinutes = () => {
  const parts = bhutanDateTimeParts();
  const get = (type) => parts.find((part) => part.type === type).value;
  return (Number(get('hour')) % 24) * 60 + Number(get('minute'));
};

function isPastWeeklyRelease(date) {
  const bookingDate = new Date(`${date}T00:00:00Z`);
  if (bookingDate.getUTCDay() !== 4) return false;
  bookingDate.setUTCDate(bookingDate.getUTCDate() - 1);
  const releaseDate = bookingDate.toISOString().slice(0, 10);
  const today = todayString();
  return today > releaseDate || (today === releaseDate && nowMinutes() >= 20 * 60);
}

// ---------- 3. who can book ----------
function roleMatches(userRole, ruleRole, gender) {
  if (ruleRole === 'student_female') return userRole === 'student' && gender === 'female';
  if (ruleRole === 'everyone') return ['student', 'faculty', 'outsider'].includes(userRole);
  if (ruleRole === 'any') return userRole === 'student' || userRole === 'outsider';
  if (ruleRole === 'student') return userRole === 'student';
  if (ruleRole === 'commercial') return ['student', 'faculty', 'outsider'].includes(userRole);
  if (['faculty', 'faculty_male', 'faculty_female'].includes(ruleRole)) return userRole === 'faculty';
  return false;
}

// Same decision the backend makes for role-specific and timed-release rules.
export function canBookSlot(userRole, rule, date, startMin, gender) {
  if (userRole === 'admin') return true;
  if (rule.primary_role === 'maintenance') return false;
  const weeklyReleasePassed = rule.fallback_type === 'weekly_release' && isPastWeeklyRelease(date);
  if (!weeklyReleasePassed && roleMatches(userRole, rule.primary_role, gender)) return true;
  if (rule.fallback_type === 'weekly_release' && rule.fallback_role && roleMatches(userRole, rule.fallback_role, gender)) {
    return weeklyReleasePassed;
  }
  // Wednesday football: female students first; opens to commercial at 12:05 AM on the day.
  if (rule.fallback_type === 'day_start_release' && rule.fallback_role && roleMatches(userRole, rule.fallback_role, gender)) {
    return date === todayString() && nowMinutes() >= 5;
  }
  if (rule.fallback_type === 'auto_release' && rule.fallback_role && roleMatches(userRole, rule.fallback_role, gender)) {
    const untilStart = startMin - nowMinutes();
    return date === todayString() && untilStart >= 0 && untilStart <= 60;
  }
  return false;
}

export function isCommercialBooking(rule, date, user) {
  if (rule.primary_role === 'commercial') return true;
  if (rule.fallback_role !== 'commercial') return false;
  if (rule.fallback_type === 'weekly_release') return isPastWeeklyRelease(date);
  if (roleMatches(user?.role, rule.primary_role, user?.gender)) return false;
  if (rule.fallback_type === 'day_start_release') {
    const today = todayString();
    return today >= date && (today > date || nowMinutes() >= 5);
  }
  if (rule.fallback_type === 'auto_release') {
    const untilStart = toMin(rule.start_time) - nowMinutes();
    return date === todayString() && untilStart >= 0 && untilStart <= 60;
  }
  return false;
}

// ---------- 4. building slots ----------
// Cuts every rule block (e.g. 16:00-22:00) into slots of `slotMinutes`.
// Courts use 60 minutes, football 120.
export function buildSlots(rules, slotMinutes) {
  const slots = [];
  for (const rule of rules) {
    let start = toMin(rule.start_time);
    const end = toMin(rule.end_time);
    while (start + slotMinutes <= end) {
      slots.push({ start: toHHMM(start), end: toHHMM(start + slotMinutes), rule });
      start += slotMinutes;
    }
  }
  return slots;
}

export function isTaken(slot, bookings) {
  return bookings.some((b) => toMin(b.start_time) < toMin(slot.end) && toMin(b.end_time) > toMin(slot.start));
}

// ---------- 5. slot state ----------
// Returns one of: 'maintenance' | 'past' | 'unavailable' | 'booked' | 'full' | 'restricted' | 'open'
// `availability` is the object from GET /facilities/:id/availability.
// With no signed-in user, a free slot is simply 'open' (the page shows "Sign in to book").
export function slotState(slot, { date, availability, user }) {
  if (availability.maintenance && availability.maintenance.length > 0) return 'maintenance';
  const startMin = toMin(slot.start);
  if (date < todayString() || (date === todayString() && startMin <= nowMinutes())) return 'past';
  if (availability.booking_window && (date < availability.booking_window.from || date > availability.booking_window.to)) {
    return 'unavailable';
  }
  if (slot.rule.primary_role === 'maintenance') return 'unavailable';
  if (isTaken(slot, availability.existing_bookings)) return 'booked';
  // weekend student matches: the day closes once the daily cap is used up
  if (availability.cap_reached && slot.rule.day_booking_cap) return 'full';
  if (user && !canBookSlot(user.role, slot.rule, date, startMin, user.gender)) return 'restricted';  
  return 'open';
}

// ---------- 6. alternatives (used by the conflict screen) ----------
// Up to `limit` open slots on the same facility and day, nearest in time to
// the slot the user wanted. The wanted slot itself is excluded.
export function findAlternatives({ availability, slotMinutes, date, user, aroundStart, limit = 3 }) {
  if (!availability) return [];
  return buildSlots(availability.rules, slotMinutes)
    .filter((s) => s.start !== aroundStart)
    .filter((s) => slotState(s, { date, availability, user }) === 'open')
    .sort((a, b) => Math.abs(toMin(a.start) - toMin(aroundStart)) - Math.abs(toMin(b.start) - toMin(aroundStart)))
    .slice(0, limit);
}
