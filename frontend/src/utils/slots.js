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
  faculty_male: 'Male faculty',
  faculty_female: 'Female faculty',
  commercial: 'Commercial / outsiders',
  maintenance: 'Maintenance / college team',
  any: 'Students or commercial (first to book)',
};

export const STATE_LABELS = {
  maintenance: 'Closed (maintenance)',
  past: 'Passed',
  unavailable: 'Not bookable',
  booked: 'Booked',
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
export const todayString = () => new Date().toLocaleDateString('en-CA');

const nowMinutes = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

// ---------- 3. who can book ----------
function roleMatches(userRole, ruleRole) {
  if (ruleRole === 'any') return userRole === 'student' || userRole === 'outsider';
  if (ruleRole === 'student') return userRole === 'student';
  if (ruleRole === 'commercial') return userRole === 'outsider';
  if (['faculty', 'faculty_male', 'faculty_female'].includes(ruleRole)) return userRole === 'faculty';
  return false;
}

// Same decision the backend makes, including the "opens to commercial
// 1 hour before start" rule for the Wednesday faculty slot.
export function canBookSlot(userRole, rule, date, startMin) {
  if (userRole === 'admin') return true;
  if (rule.primary_role === 'maintenance') return false;
  if (roleMatches(userRole, rule.primary_role)) return true;
  if (rule.fallback_type === 'auto_release' && rule.fallback_role && roleMatches(userRole, rule.fallback_role)) {
    const untilStart = startMin - nowMinutes();
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
// Returns one of: 'maintenance' | 'past' | 'unavailable' | 'booked' | 'restricted' | 'open'
// `availability` is the object from GET /facilities/:id/availability.
// With no signed-in user, a free slot is simply 'open' (the page shows "Sign in to book").
export function slotState(slot, { date, availability, user }) {
  if (availability.maintenance && availability.maintenance.length > 0) return 'maintenance';
  const startMin = toMin(slot.start);
  if (date < todayString() || (date === todayString() && startMin <= nowMinutes())) return 'past';
  if (slot.rule.primary_role === 'maintenance') return 'unavailable';
  if (isTaken(slot, availability.existing_bookings)) return 'booked';
  if (user && !canBookSlot(user.role, slot.rule, date, startMin)) return 'restricted';
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