// =============================================================
// Backend/src/db.js  —  PostgreSQL connection pool
// =============================================================
// Reads DATABASE_URL from Backend/.env (never commit that file).
// Render's database needs SSL. If you ever run a LOCAL Postgres that
// has no SSL, add  DB_SSL=false  to your .env.

// ==============================================================
// IMPORTS - load the postgres package
// ==============================================================
const { Pool } = require('pg');                             // pool class from the pg package

// ==============================================================
// SETTINGS - decide if the connection uses ssl
// ==============================================================
// ssl is on unless DB_SSL is set to the text false in .env
const useSsl = process.env.DB_SSL !== 'false';              // true or false

// ==============================================================
// POOL - make the database connection pool
// ==============================================================
const pool = new Pool({                                     // new pool of connections
  connectionString: process.env.DATABASE_URL,               // database link from .env
  // use ssl if on, and allow the render certificate, else no ssl
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});                                                         // end of pool

// ==============================================================
// EXPORT - let other files use the pool
// ==============================================================
module.exports = pool;                                      // share the pool