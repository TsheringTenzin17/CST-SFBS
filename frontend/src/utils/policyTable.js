// =============================================================
// frontend/src/utils/policyTable.js  —  schedule_rules -> allocation table
// =============================================================
// Used by the admin "System Settings" page. It reads the same schedule_rules
// the booking API enforces, so the table can never drift from the real rules.
//
//   buildPolicy(rules, 'standard')  ->  [{ dow, name, maintenance, cells }, ...]  Monday..Sunday
//   cells = { students, staff, commercial }, each { ranges: [{ start, end, note }], cap }

export const COLUMNS = [
  { key: 'students', label: 'Students' },
  { key: 'staff', label: 'Faculty / Staff' },
  { key: 'commercial', label: 'Commercial' },
];

// Monday first, as on the DSA timetable (day_of_week: 0 = Sunday)
export const DAYS = [
  { dow: 1, name: 'Monday' },
  { dow: 2, name: 'Tuesday' },
  { dow: 3, name: 'Wednesday' },
  { dow: 4, name: 'Thursday' },
  { dow: 5, name: 'Friday' },
  { dow: 6, name: 'Saturday' },
  { dow: 0, name: 'Sunday' },
];

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

// Same role meanings as isRoleEligible() in Backend/src/routes/bookings.js
function columnsFor(role) {
  switch (role) {
    case 'student':
    case 'student_female':
      return ['students'];
    case 'faculty':
    case 'faculty_male':
    case 'faculty_female':
      return ['staff'];
    case 'commercial':
      return ['commercial'];
    case 'any':
      return ['students', 'commercial'];
    case 'everyone':
      return ['students', 'staff', 'commercial'];
    default:
      return [];
  }
}

const ROLE_NOTE = {
  student_female: 'female students only',
  faculty_male: 'male staff only',
  faculty_female: 'female staff only',
};

const emptyCell = () => ({ ranges: [], cap: null });

// Join back-to-back ranges that carry the same note (6-8 + 8-10 -> 6-10).
function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => toMin(a.start) - toMin(b.start));
  const out = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && last.end === range.start && last.note === range.note) last.end = range.end;
    else out.push({ ...range });
  }
  return out;
}

// view: 'standard' (no tournament) or 'tournament'. Rules marked 'all' apply to both.
export function buildPolicy(rules, view = 'standard') {
  return DAYS.map(({ dow, name }) => {
    const dayRules = rules.filter(
      (r) => r.day_of_week === dow && ['all', view].includes(r.timetable || 'all')
    );
    const cells = { students: emptyCell(), staff: emptyCell(), commercial: emptyCell() };
    let maintenance = null;

    for (const rule of dayRules) {
      const start = String(rule.start_time).slice(0, 5);
      const end = String(rule.end_time).slice(0, 5);

      if (rule.primary_role === 'maintenance') {
        maintenance = { start, end };
        continue;
      }
      for (const col of columnsFor(rule.primary_role)) {
        cells[col].ranges.push({ start, end, note: ROLE_NOTE[rule.primary_role] || '' });
        if (rule.day_booking_cap) cells[col].cap = rule.day_booking_cap;
      }
      // Wednesday football: the slot opens to another group shortly before it starts
      if (rule.fallback_role && rule.fallback_type === 'auto_release') {
        for (const col of columnsFor(rule.fallback_role)) {
          cells[col].ranges.push({ start, end, note: 'opens 1 hour before' });
        }
      }
    }

    for (const col of Object.keys(cells)) cells[col].ranges = mergeRanges(cells[col].ranges);
    return { dow, name, maintenance, cells };
  });
}

// True when the facility has rules that differ between standard and tournament dates.
export const hasTournamentTimetable = (rules) => rules.some((r) => (r.timetable || 'all') !== 'all');

// Two courts with the same rules (Badminton 1 and 2) are shown as one table.
export const rulesSignature = (rules) =>
  JSON.stringify(
    rules
      .map((r) => [r.day_of_week, r.start_time, r.end_time, r.primary_role, r.fallback_role || '', r.fallback_type || '', r.timetable, r.day_booking_cap || 0])
      .sort()
  );
