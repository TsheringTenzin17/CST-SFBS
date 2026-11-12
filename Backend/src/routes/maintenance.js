// =============================================================
// Backend/src/routes/maintenance.js  —  closing a facility for repairs
// =============================================================
// GET    /maintenance                       list all blocks (anyone can read)
// POST   /maintenance                       add a block      (admin only)
// PATCH  /maintenance/:id                  edit a block     (admin only)
// DELETE /maintenance/:id                  remove a block   (admin only)
// While a block covers a date, the booking API refuses that facility
// and the availability page shows "closed for maintenance".

// ==============================================================
// IMPORTS - load the packages and helper files we need
// ==============================================================
const express = require('express');                                                         // web framework
const pool = require('../db');                                                              // database connection pool
const { requireAdmin } = require('../auth');                                                // only lets admins through
const { isValidDate } = require('../time');                                                 // checks date is YYYY-MM-DD
const router = express.Router();                                                            // new router for this file

// ==============================================================
// GET / - send back every maintenance block
// ==============================================================
router.get('/', async (req, res) => {                                                       // anyone can call this
  try {                                                                                     // catch any db error
    // query joins facilities so we can show the facility name
    const result = await pool.query(                                                        // run the select
      `SELECT m.id, m.facility_id, f.name AS facility_name, m.reason,
              to_char(m.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(m.end_date, 'YYYY-MM-DD') AS end_date
       FROM maintenance_blocks m JOIN facilities f ON f.id = m.facility_id
       ORDER BY m.start_date DESC`,
    );                                                                                      // end of query
    res.json(result.rows);                                                                  // send rows back
  } catch (err) {                                                                           // something went wrong
    console.error(err);                                                                     // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to fetch maintenance blocks' });
  }                                                                                         // end of catch
});                                                                                         // end of get route

// ==============================================================
// POST / - add a new maintenance block (admin only)
// ==============================================================
router.post('/', requireAdmin, async (req, res) => {                                        // admin check runs first
  // ----------------------------------------------------------
  // check the data the admin sent
  // ----------------------------------------------------------
  const { facility_id, start_date, end_date, reason } = req.body;                           // take values from body
  // all three must be there and dates must be valid
  if (!facility_id || !isValidDate(start_date) || !isValidDate(end_date)) {                 // missing or bad data
    return res                                                                              // stop here and reply
      .status(400)                                                                          // bad request code
      .json({ error: 'facility_id, start_date and end_date (YYYY-MM-DD) are required' });   // tell what is missing
  }                                                                                         // end of if
  if (end_date < start_date)                                                                // end is before start
    // dates are text so we can compare them like this
    return res.status(400).json({ error: 'End date cannot be before start date' });
  // reason is optional but if given it must be text and short
  if (reason != null && (typeof reason !== 'string' || reason.trim().length > 500)) {       // reason not ok
    return res.status(400).json({ error: 'Reason must be 500 characters or fewer' });       // tell the limit
  }                                                                                         // end of if
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';                      // trim spaces, or empty text

  // ----------------------------------------------------------
  // start the transaction so everything saves together
  // ----------------------------------------------------------
  const client = await pool.connect();                                                      // get one db connection
  let transactionStarted = false;                                                           // remember if begin ran
  try {                                                                                     // catch errors below
    await client.query('BEGIN');                                                            // start transaction
    transactionStarted = true;                                                              // now rollback is needed on error

    // ----------------------------------------------------------
    // save the maintenance block
    // ----------------------------------------------------------
    // insert the new block and get its id back
    const inserted = await client.query(                                                    // run the insert
      `INSERT INTO maintenance_blocks (facility_id, start_date, end_date, reason, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [facility_id, start_date, end_date, cleanReason || null, req.user.id],                // values for $1 to $5
    );                                                                                      // end of insert

    // ----------------------------------------------------------
    // find affected bookings and who to tell
    // ----------------------------------------------------------
    // Count affected reservations and notify each affected account once, respecting saved preferences.
    // count bookings that fall inside the blocked dates
    const affected = await client.query(                                                    // run the count
      `SELECT COUNT(*)::int AS n FROM bookings
       WHERE facility_id = $1 AND status NOT IN ('cancelled', 'expired') AND booking_date BETWEEN $2 AND $3`,
      [facility_id, start_date, end_date],                                                  // values for $1 to $3
    );                                                                                      // end of count
    // one row per user, skip users who turned alerts off
    const recipients = await client.query(                                                  // run the select
      `SELECT b.user_id, COUNT(*)::int AS booking_count, f.name AS facility_name
       FROM bookings b
       JOIN facilities f ON f.id = b.facility_id
       LEFT JOIN user_notification_preferences p ON p.user_id = b.user_id
       WHERE b.facility_id = $1
         AND b.status NOT IN ('cancelled', 'expired')
         AND b.booking_date BETWEEN $2 AND $3
         AND COALESCE(p.maintenance_alerts, true) = true
       GROUP BY b.user_id, f.name`,
      [facility_id, start_date, end_date],                                                  // values for $1 to $3
    );                                                                                      // end of select

    // ----------------------------------------------------------
    // send a notification to each user
    // ----------------------------------------------------------
    for (const recipient of recipients.rows) {                                              // go through each user
      const reasonText = cleanReason ? ` Reason: ${cleanReason}` : '';                      // add reason only if given
      await client.query(                                                                   // save the notification
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, 'maintenance_scheduled', $2)`,
        // $1 is the user, $2 is the message text built below
        [
          recipient.user_id,
          `Maintenance has been scheduled for ${recipient.facility_name} from ${start_date} to ${end_date}. ` +
            `${recipient.booking_count} of your active booking(s) may be affected.${reasonText}`,
        ],                                                                                  // end of values
      );                                                                                    // end of insert
    }                                                                                       // end of loop

    // ----------------------------------------------------------
    // save everything and reply
    // ----------------------------------------------------------
    await client.query('COMMIT');                                                           // save all changes
    transactionStarted = false;                                                             // nothing to rollback now
    res.status(201).json({                                                                  // 201 means created
      id: inserted.rows[0].id,                                                              // id of the new block
      affected_bookings: affected.rows[0].n,                                                // how many bookings hit
      notified_users: recipients.rows.length,                                               // how many users told
    });                                                                                     // end of reply
  } catch (err) {                                                                           // something went wrong
    if (transactionStarted) await client.query('ROLLBACK');                                 // undo everything if begun
    console.error(err);                                                                     // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to create maintenance block' });
  } finally {                                                                               // always runs at the end
    client.release();                                                                       // give connection back to pool
  }                                                                                         // end of try
});                                                                                         // end of post route

// ==============================================================
// PATCH /:id - edit a maintenance block (admin only)
// ==============================================================
router.patch('/:id', requireAdmin, async (req, res) => {                                    // admin check runs first
  // ----------------------------------------------------------
  // check the id and the data
  // ----------------------------------------------------------
  const blockId = Number(req.params.id);                                                    // turn id text into number
  if (!Number.isSafeInteger(blockId) || blockId <= 0)                                       // id not a good number
    return res.status(400).json({ error: 'Invalid block id' });                             // tell id is bad
  const { facility_id, start_date, end_date, reason } = req.body;                           // take values from body
  // all three must be there and dates must be valid
  if (!facility_id || !isValidDate(start_date) || !isValidDate(end_date)) {                 // missing or bad data
    return res                                                                              // stop here and reply
      .status(400)                                                                          // bad request code
      .json({ error: 'facility_id, start_date and end_date (YYYY-MM-DD) are required' });   // tell what is missing
  }                                                                                         // end of if
  if (end_date < start_date)                                                                // end is before start
    // dates are text so we can compare them like this
    return res.status(400).json({ error: 'End date cannot be before start date' });
  // reason is optional but if given it must be text and short
  if (reason != null && (typeof reason !== 'string' || reason.trim().length > 500)) {       // reason not ok
    return res.status(400).json({ error: 'Reason must be 500 characters or fewer' });       // tell the limit
  }                                                                                         // end of if
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';                      // trim spaces, or empty text

  // ----------------------------------------------------------
  // start the transaction so everything saves together
  // ----------------------------------------------------------
  const client = await pool.connect();                                                      // get one db connection
  let transactionStarted = false;                                                           // remember if begin ran
  try {                                                                                     // catch errors below
    await client.query('BEGIN');                                                            // start transaction
    transactionStarted = true;                                                              // now rollback is needed on error

    // ----------------------------------------------------------
    // update the maintenance block
    // ----------------------------------------------------------
    // change the row that has this id
    const updated = await client.query(                                                     // run the update
      `UPDATE maintenance_blocks SET facility_id = $1, start_date = $2, end_date = $3, reason = $4
       WHERE id = $5 RETURNING id`,
      [facility_id, start_date, end_date, cleanReason || null, blockId],                    // values for $1 to $5
    );                                                                                      // end of update
    if (updated.rows.length === 0) {                                                        // no row had this id
      await client.query('ROLLBACK');                                                       // undo and stop
      transactionStarted = false;                                                           // rollback already done
      return res.status(404).json({ error: 'Maintenance block not found' });                // tell it was not found
    }                                                                                       // end of if

    // ----------------------------------------------------------
    // find affected bookings and who to tell
    // ----------------------------------------------------------
    // Same notification rules as creating a block, for the new facility and dates.
    // count bookings that fall inside the blocked dates
    const affected = await client.query(                                                    // run the count
      `SELECT COUNT(*)::int AS n FROM bookings
       WHERE facility_id = $1 AND status NOT IN ('cancelled', 'expired') AND booking_date BETWEEN $2 AND $3`,
      [facility_id, start_date, end_date],                                                  // values for $1 to $3
    );                                                                                      // end of count
    // one row per user, skip users who turned alerts off
    const recipients = await client.query(                                                  // run the select
      `SELECT b.user_id, COUNT(*)::int AS booking_count, f.name AS facility_name
       FROM bookings b
       JOIN facilities f ON f.id = b.facility_id
       LEFT JOIN user_notification_preferences p ON p.user_id = b.user_id
       WHERE b.facility_id = $1
         AND b.status NOT IN ('cancelled', 'expired')
         AND b.booking_date BETWEEN $2 AND $3
         AND COALESCE(p.maintenance_alerts, true) = true
       GROUP BY b.user_id, f.name`,
      [facility_id, start_date, end_date],                                                  // values for $1 to $3
    );                                                                                      // end of select

    // ----------------------------------------------------------
    // send a notification to each user
    // ----------------------------------------------------------
    for (const recipient of recipients.rows) {                                              // go through each user
      const reasonText = cleanReason ? ` Reason: ${cleanReason}` : '';                      // add reason only if given
      await client.query(                                                                   // save the notification
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, 'maintenance_scheduled', $2)`,
        // $1 is the user, $2 is the message text built below
        [
          recipient.user_id,
          `Maintenance for ${recipient.facility_name} has been updated to ${start_date} - ${end_date}. ` +
            `${recipient.booking_count} of your active booking(s) may be affected.${reasonText}`,
        ],                                                                                  // end of values
      );                                                                                    // end of insert
    }                                                                                       // end of loop

    // ----------------------------------------------------------
    // save everything and reply
    // ----------------------------------------------------------
    await client.query('COMMIT');                                                           // save all changes
    transactionStarted = false;                                                             // nothing to rollback now
    res.json({                                                                              // send result back
      id: blockId,                                                                          // id of the edited block
      affected_bookings: affected.rows[0].n,                                                // how many bookings hit
      notified_users: recipients.rows.length,                                               // how many users told
    });                                                                                     // end of reply
  } catch (err) {                                                                           // something went wrong
    if (transactionStarted) await client.query('ROLLBACK');                                 // undo everything if begun
    console.error(err);                                                                     // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to update maintenance block' });
  } finally {                                                                               // always runs at the end
    client.release();                                                                       // give connection back to pool
  }                                                                                         // end of try
});                                                                                         // end of patch route

// ==============================================================
// DELETE /:id - remove a maintenance block (admin only)
// ==============================================================
router.delete('/:id', requireAdmin, async (req, res) => {                                   // admin check runs first
  try {                                                                                     // catch any db error
    await pool.query('DELETE FROM maintenance_blocks WHERE id = $1', [req.params.id]);      // delete the row with this id
    res.json({ deleted: true });                                                            // tell it worked
  } catch (err) {                                                                           // something went wrong
    console.error(err);                                                                     // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to remove maintenance block' });
  }                                                                                         // end of catch
});                                                                                         // end of delete route

// ==============================================================
// EXPORT - let server file use this router
// ==============================================================
module.exports = router;                                                                    // share the router
