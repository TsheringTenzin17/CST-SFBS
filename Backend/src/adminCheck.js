// =============================================================
// Backend/src/adminCheck.js  —  "is this user an admin?"
// =============================================================
// NOTE (limitation to mention in the report): there are no session tokens.
// The browser sends the admin's user id and the server checks that user's
// role in the database. That is fine for a pilot; real session tokens (JWT)
// would be the next step before wider use.

// ==============================================================
// IMPORTS - load the helper files we need
// ==============================================================
const pool = require('./db');                               // database connection pool

// ==============================================================
// isAdmin - check in the database if a user is an admin
// ==============================================================
async function isAdmin(userId) {                            // gives back true or false
  // ----------------------------------------------------------
  // check the user id
  // ----------------------------------------------------------
  const id = Number(userId);                                // turn id into a number
  // id must be a whole number bigger than 0
  if (!Number.isInteger(id) || id <= 0) return false;       // bad id so not an admin

  // ----------------------------------------------------------
  // look up the role in the database
  // ----------------------------------------------------------
  // get the role of this user
  const r = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
  // true only if the user exists and the role is admin
  return r.rows.length > 0 && r.rows[0].role === 'admin';
}                                                           // end of function

// ==============================================================
// EXPORT - let other files use this function
// ==============================================================
module.exports = { isAdmin };                               // share the function