// =============================================================
// Backend/src/routes/tournaments.js  —  department tournament periods
// =============================================================
// GET    /tournaments        list periods                  (anyone can read)
// POST   /tournaments        add a period                  (admin only)
// DELETE /tournaments/:id    remove a period               (admin only)
// A date inside a period uses the football "tournament" timetable
// (students play 8-10 PM, etc.); every other date uses "standard".

// ==============================================================
// IMPORTS - load the packages and helper files we need
// ==============================================================
const express = require('express');                         // web framework
const pool = require('../db');                              // database connection pool
const { requireAdmin } = require('../auth');                // only lets admins through
const { isValidDate } = require('../time');                 // checks date is YYYY-MM-DD
const router = express.Router();                            // new router for this file

// ==============================================================
// GET / - send back every tournament period
// ==============================================================
router.get('/', async (req, res) => {                      // anyone can call this
  try {                                                     // catch any db error
    // select all periods, newest start date first
    const result = await pool.query(                        // run the select
      `SELECT id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date, 'YYYY-MM-DD') AS end_date
       FROM tournament_periods ORDER BY start_date DESC`,
    );                                                      // end of query
    res.json(result.rows);                                  // send rows back
  } catch (err) {                                           // something went wrong
    console.error(err);                                     // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to fetch tournament periods' });
  }                                                         // end of catch
});                                                         // end of get route

// ==============================================================
// POST / - add a new tournament period (admin only)
// ==============================================================
router.post('/', requireAdmin, async (req, res) => {       // admin check runs first
  // ----------------------------------------------------------
  // check the data the admin sent
  // ----------------------------------------------------------
  const { name, start_date, end_date } = req.body;          // take values from body
  if (!isValidDate(start_date) || !isValidDate(end_date)) { // bad or missing dates
    // stop here and tell what is needed
    return res.status(400).json({ error: 'start_date and end_date (YYYY-MM-DD) are required' });
  }                                                         // end of if
  if (end_date < start_date)                                // end is before start
    // dates are text so we can compare them like this
    return res.status(400).json({ error: 'End date cannot be before start date' });
  // name is optional but if given it must be text and short
  if (name != null && (typeof name !== 'string' || name.trim().length > 120)) {
    // stop here and tell the limit
    return res.status(400).json({ error: 'Name must be 120 characters or fewer' });
  }                                                         // end of if

  // ----------------------------------------------------------
  // save the period in the database
  // ----------------------------------------------------------
  try {                                                     // catch any db error
    // insert the new period and get its id back
    const inserted = await pool.query(                      // run the insert
      `INSERT INTO tournament_periods (name, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [                                                     // values for $1 to $4
        // trimmed name, or null if it is empty
        typeof name === 'string' && name.trim() ? name.trim() : null,
        start_date,                                         // first day of the period
        end_date,                                           // last day of the period
        req.user.id,                                        // the admin who added it
      ],                                                    // end of values
    );                                                      // end of insert
    res.status(201).json({ id: inserted.rows[0].id });      // 201 means created, send new id
  } catch (err) {                                           // something went wrong
    console.error(err);                                     // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to add tournament period' });
  }                                                         // end of catch
});                                                         // end of post route

// ==============================================================
// DELETE /:id - remove a tournament period (admin only)
// ==============================================================
router.delete('/:id', requireAdmin, async (req, res) => {  // admin check runs first
  // ----------------------------------------------------------
  // check the id
  // ----------------------------------------------------------
  const id = Number(req.params.id);                         // turn id text into number
  // id must be a whole number bigger than 0
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  // ----------------------------------------------------------
  // delete the period
  // ----------------------------------------------------------
  try {                                                     // catch any db error
    // delete the row with this id
    const result = await pool.query('DELETE FROM tournament_periods WHERE id = $1', [id]);
    if (result.rowCount === 0)                              // no row had this id
      // tell it was not found
      return res.status(404).json({ error: 'Tournament period not found' });
    res.json({ deleted: id });                              // tell it worked and send the id
  } catch (err) {                                           // something went wrong
    console.error(err);                                     // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to delete tournament period' });
  }                                                         // end of catch
});                                                         // end of delete route

// ==============================================================
// EXPORT - let server file use this router
// ==============================================================
module.exports = router;                                    // share the router