// =============================================================
// frontend/src/utils/format.js  —  small display helpers
// =============================================================

// '2026-10-25'  ->  'Sunday, 25 October 2026'
export function prettyDate(d) {
  if (!d) return '';
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}