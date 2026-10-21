// =============================================================
// Backend/src/adminCheck.js  —  "is this user an admin?"
// =============================================================
// NOTE (limitation to mention in the report): there are no session tokens.
// The browser sends the admin's user id and the server checks that user's
// role in the database. That is fine for a pilot; real session tokens (JWT)
// would be the next step before wider use.
const pool = require('./db');

async function isAdmin(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return false;
  const r = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
  return r.rows.length > 0 && r.rows[0].role === 'admin';
}

module.exports = { isAdmin };