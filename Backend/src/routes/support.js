// ==============================================================
// IMPORTS - load the packages and helper files we need
// ==============================================================
const express = require('express');                         // web framework
const pool = require('../db');                              // database connection pool
const { authenticate } = require('../auth');                // checks the user is logged in

const router = express.Router();                            // new router for this file
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;         // simple email check

// ==============================================================
// OPTIONAL AUTH - login is not needed, but use it if it is sent
// ==============================================================
// Contact remains available to visitors, while valid sessions link requests to an account.
function optionalAuthenticate(req, res, next) {             // middleware for the route
  if (!req.get('authorization')) return next();             // no token so skip the login check
  return authenticate(req, res, next);                      // token sent so check it
}                                                           // end of function

// ==============================================================
// POST /requests - save a support request from the contact form
// ==============================================================
// optional login runs first, then this function
router.post('/requests', optionalAuthenticate, async (req, res) => {
  // ----------------------------------------------------------
  // clean the data the user sent
  // ----------------------------------------------------------
  const { name, email, message } = req.body;                // take values from body
  // trim name if it is text, else use empty text
  const cleanName = typeof name === 'string' ? name.trim() : '';
  // trim email and make it lowercase
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  // trim message if it is text, else use empty text
  const cleanMessage = typeof message === 'string' ? message.trim() : '';

  // ----------------------------------------------------------
  // check the cleaned data
  // ----------------------------------------------------------
  if (!cleanName || cleanName.length > 120) {               // name empty or too long
    // stop here and tell the name rule
    return res.status(400).json({ error: 'Name is required and must be 120 characters or fewer' });
  }                                                         // end of if
  // email must be there, short enough, and look like an email
  if (!cleanEmail || cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)) {
    // stop here and tell the email is bad
    return res.status(400).json({ error: 'Enter a valid response email address' });
  }                                                         // end of if
  if (!cleanMessage || cleanMessage.length > 3000) {        // message empty or too long
    return res                                              // stop here and reply
      .status(400)                                          // bad request code
      // tell the message rule
      .json({ error: 'Message is required and must be 3000 characters or fewer' });
  }                                                         // end of if

  // ----------------------------------------------------------
  // save the request in the database
  // ----------------------------------------------------------
  try {                                                     // catch any db error
    // Retain the user link when signed in, but never require an account to contact the office.
    // insert the request and get id and year back
    const result = await pool.query(                        // run the insert
      `INSERT INTO support_requests (user_id, name, email, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, to_char(created_at, 'YYYY') AS year`,
      // user id is null if the user is not logged in
      [req.user?.id || null, cleanName, cleanEmail, cleanMessage],
    );                                                      // end of insert
    const request = result.rows[0];                         // the new row we just saved

    // ----------------------------------------------------------
    // send the ticket back to the user
    // ----------------------------------------------------------
    res.status(201).json({                                  // 201 means created
      // ticket looks like CST-2026-000123 (id padded to 6 digits)
      ticket_id: `CST-${request.year}-${String(request.id).padStart(6, '0')}`,
      response_email: cleanEmail,                           // email we will reply to
      status: 'pending_review',                             // new requests wait for review
    });                                                     // end of reply
  } catch (error) {                                         // something went wrong
    console.error(error);                                   // show error in terminal
    // send 500 only if no reply was sent yet
    if (!res.headersSent) res.status(500).json({ error: 'Could not save your support request' });
  }                                                         // end of catch
});                                                         // end of post route

// ==============================================================
// EXPORT - let server file use this router
// ==============================================================
module.exports = router;                                    // share the router
