// =============================================================
// Backend/src/timetable.js  —  which football timetable applies on a date?
// =============================================================
// The DSA has two football timetables (Timings.docx):
//   'tournament' = a date inside an admin-created tournament period
//   'standard'   = every other date
// schedule_rules rows marked 'all' apply to both.
async function timetableForDate(queryable, date) {
  const result = await queryable.query(
    'SELECT 1 FROM tournament_periods WHERE $1::date BETWEEN start_date AND end_date LIMIT 1',
    [date]
  );
  return result.rows.length > 0 ? 'tournament' : 'standard';
}

module.exports = { timetableForDate };
