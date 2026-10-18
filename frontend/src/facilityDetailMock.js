// Temporary fake data so the page works without a database.
// Later you'll replace this with data from your backend.

// The 7 columns of the grid. Each day has:
//   key   = unique id (used by React)
//   label = text shown in the grid header
//   who   = who is allowed to book that day (shown in the rules box)
export const DAYS = [
  { key: 'mon', label: 'Mon (St.)', who: 'Strictly Students' },
  { key: 'tue', label: 'Tue (Fac.)', who: 'Faculty & CST Staff' },
  { key: 'wed', label: 'Wed (St.)', who: 'Strictly Students' },
  { key: 'thu', label: 'Thu (Fac.)', who: 'Faculty & CST Staff' },
  { key: 'fri', label: 'Fri (Com.)', who: 'Commercial / Outsiders' },
  { key: 'sat', label: 'Sat (Dept.)', who: 'CST Departmental Leagues' },
  { key: 'sun', label: 'Sun', who: 'All-day availability' },
];

// The 8 rows of the grid (time slots)
export const TIME_SLOTS = [
  '06:00 - 08:00 AM',
  '08:00 - 10:00 AM',
  '10:00 - 12:00 PM',
  '12:00 - 02:00 PM',
  '02:00 - 04:00 PM',
  '04:00 - 06:00 PM',
  '06:00 - 08:00 PM',
  '08:00 - 10:00 PM',
];

// 'A' = available, 'B' = booked, 'U' = unavailable.
// Each inner list is ONE time slot (row); its 7 letters are Mon to Sun (columns).
export const SAMPLE_GRID = [
  ['A', 'B', 'A', 'B', 'A', 'B', 'A'],
  ['B', 'B', 'A', 'B', 'A', 'B', 'A'],
  ['A', 'A', 'B', 'A', 'B', 'A', 'A'],
  ['B', 'A', 'A', 'A', 'B', 'A', 'A'],
  ['A', 'B', 'A', 'B', 'A', 'A', 'A'],
  ['B', 'B', 'B', 'A', 'A', 'A', 'A'],
  ['A', 'B', 'A', 'B', 'A', 'A', 'A'],
  ['B', 'A', 'A', 'B', 'A', 'A', 'A'],
];