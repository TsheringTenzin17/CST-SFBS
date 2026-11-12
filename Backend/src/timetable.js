// =============================================================
// Backend/src/timetable.js  —  which football timetable applies on a date?
// =============================================================
// The DSA has two football timetables (Timings.docx):
//   'tournament' = a date inside an admin-created tournament period
//   'standard'   = every other date
// schedule_rules rows marked 'all' apply to both.

// ==============================================================
// timetableForDate - pick the timetable for one date
// ==============================================================
// queryable can be the pool or a client, both have .query
async function timetableForDate(queryable, date) {         // gives back tournament or standard
  // ----------------------------------------------------------
  // look for a tournament period that has this date
  // ----------------------------------------------------------
  // find any period where the date is between start and end
  const result = await queryable.query(                     // run the select
    'SELECT 1 FROM tournament_periods WHERE $1::date BETWEEN start_date AND end_date LIMIT 1',
    [date],                                                 // $1 is the date we check
  );                                                        // end of query

  // ----------------------------------------------------------
  // give back the answer
  // ----------------------------------------------------------
  // a row means the date is inside a tournament period
  return result.rows.length > 0 ? 'tournament' : 'standard';
}                                                           // end of function

// ==============================================================
// EXPORT - let other files use this function
// ==============================================================
module.exports = { timetableForDate };                      // share the function
