// ==============================================================
// IMPORTS - load the packages and helper files we need
// ==============================================================
const express = require('express');                         // web framework
const pool = require('../db');                              // database connection pool
const { authenticate } = require('../auth');                // checks the user is logged in

const router = express.Router();                            // new router for this file

// ==============================================================
// AUTH - every route below needs a logged in user
// ==============================================================
// Every notification operation is scoped to the authenticated account.
router.use(authenticate);                                   // run login check on all routes

// ==============================================================
// GET / - send back the user's notifications from last 7 days
// ==============================================================
router.get('/', async (req, res) => {                       // get all my notifications
  try {                                                     // catch any db error
    // select only my rows, from the last 7 days, newest first
    const result = await pool.query(                        // run the select
      `SELECT id, type, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
         AND created_at >= now() - INTERVAL '7 days'
       ORDER BY created_at DESC, id DESC`,
      [req.user.id],                                        // $1 is my user id
    );                                                      // end of query
    res.json(result.rows);                                  // send rows back
  } catch (error) {                                         // something went wrong
    console.error(error);                                   // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }                                                         // end of catch
});                                                         // end of get route

// ==============================================================
// PATCH /read-all - mark all my notifications as read
// ==============================================================
router.patch('/read-all', async (req, res) => {             // mark everything as read
  try {                                                     // catch any db error
    // Updating only unread rows keeps the response count meaningful and avoids needless writes.
    // update only my unread rows
    const result = await pool.query(                        // run the update
      `UPDATE notifications SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id],                                        // $1 is my user id
    );                                                      // end of update
    res.json({ updated: result.rowCount });                 // tell how many rows changed
  } catch (error) {                                         // something went wrong
    console.error(error);                                   // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }                                                         // end of catch
});                                                         // end of read-all route

// ==============================================================
// DELETE / - clear all my notifications
// ==============================================================
router.delete('/', async (req, res) => {                    // delete all my notifications
  try {                                                     // catch any db error
    // delete every row that belongs to me
    const result = await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    res.json({ deleted: result.rowCount });                 // tell how many rows were deleted
  } catch (error) {                                         // something went wrong
    console.error(error);                                   // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to clear notifications' });
  }                                                         // end of catch
});                                                         // end of delete all route

// ==============================================================
// PATCH /:id/read - mark one notification as read
// ==============================================================
router.patch('/:id/read', async (req, res) => {             // mark one as read
  // ----------------------------------------------------------
  // check the id
  // ----------------------------------------------------------
  const notificationId = Number(req.params.id);             // turn id text into number
  // id must be a whole number bigger than 0
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    // stop here and tell id is bad
    return res.status(400).json({ error: 'Invalid notification id' });
  }                                                         // end of if

  // ----------------------------------------------------------
  // update the notification
  // ----------------------------------------------------------
  try {                                                     // catch any db error
    // The owner condition prevents users from reading or changing another account's notification.
    // update only if the row is mine
    const result = await pool.query(                        // run the update
      `UPDATE notifications SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, type, message, is_read, created_at`,
      [notificationId, req.user.id],                        // $1 is notification, $2 is me
    );                                                      // end of update
    if (result.rows.length === 0) {                         // no row matched
      // tell it was not found
      return res.status(404).json({ error: 'Notification not found' });
    }                                                       // end of if
    res.json({ notification: result.rows[0] });             // send the updated row back
  } catch (error) {                                         // something went wrong
    console.error(error);                                   // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }                                                         // end of catch
});                                                         // end of read one route

// ==============================================================
// DELETE /:id - delete one notification
// ==============================================================
router.delete('/:id', async (req, res) => {                 // delete one notification
  // ----------------------------------------------------------
  // check the id
  // ----------------------------------------------------------
  const notificationId = Number(req.params.id);             // turn id text into number
  // id must be a whole number bigger than 0
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    // stop here and tell id is bad
    return res.status(400).json({ error: 'Invalid notification id' });
  }                                                         // end of if

  // ----------------------------------------------------------
  // delete the notification
  // ----------------------------------------------------------
  try {                                                     // catch any db error
    // delete only if the row is mine
    const result = await pool.query(                        // run the delete
      `DELETE FROM notifications
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, req.user.id],                        // $1 is notification, $2 is me
    );                                                      // end of delete
    if (result.rows.length === 0) {                         // no row matched
      // tell it was not found
      return res.status(404).json({ error: 'Notification not found' });
    }                                                       // end of if
    res.json({ deleted: true, id: result.rows[0].id });     // tell it worked and send the id
  } catch (error) {                                         // something went wrong
    console.error(error);                                   // show error in terminal
    // send 500 with a simple message
    res.status(500).json({ error: 'Failed to delete notification' });
  }                                                         // end of catch
});                                                         // end of delete one route

// ==============================================================
// EXPORT - let server file use this router
// ==============================================================
module.exports = router;                                    // share the router