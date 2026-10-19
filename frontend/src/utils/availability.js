// =============================================================
// frontend/src/utils/availability.js  —  badges + slot counts for the cards
// =============================================================
// Turns the rows from GET /facilities/summary into one entry per SPORT
// (Badminton Court 1 + 2 become one "Badminton Court" card).

// rows -> { 'Badminton Court': { available: 9, total: 12, blocked: false }, ... }
export function groupSummary(rows) {
  const groups = {};
  for (const r of rows) {
    if (!groups[r.group_name]) groups[r.group_name] = { available: 0, total: 0, blocked: false };
    groups[r.group_name].available += r.available;
    groups[r.group_name].total += r.total;
    groups[r.group_name].blocked = groups[r.group_name].blocked || r.blocked;
  }
  return groups;
}

// The coloured pill on a facility card. `s` may be undefined while loading.
export function badgeFor(s) {
  if (!s) return { label: '', variant: 'blue' };
  if (s.blocked) return { label: 'Closed today', variant: 'orange' };
  if (s.total === 0) return { label: 'No slots today', variant: 'orange' };
  if (s.available === 0) return { label: 'No slots remaining today', variant: 'red' };
  return { label: 'Available today', variant: 'green' };
}

export function slotsText(s) {
  if (!s) return '';
  if (s.total === 0) return 'No slots today';
  return `${s.available} of ${s.total} slots free`;
}

// facilities (one row per court) -> one entry per SPORT, for the cards.
// [{ ...firstCourt, displayName: 'Badminton Court', courtCount: 2, courtIds: [5, 6] }, ...]
export function groupFacilities(facilities) {
  const groups = {};
  for (const f of facilities) {
    if (!groups[f.group_name]) groups[f.group_name] = { ...f, displayName: f.group_name, courtCount: 0, courtIds: [] };
    groups[f.group_name].courtCount += 1;
    groups[f.group_name].courtIds.push(f.id);
  }
  return Object.values(groups);
}