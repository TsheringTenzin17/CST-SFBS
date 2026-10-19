// =============================================================
// Backend/src/db.js  —  PostgreSQL connection pool
// =============================================================
// Reads DATABASE_URL from Backend/.env (never commit that file).
// Render's database needs SSL. If you ever run a LOCAL Postgres that
// has no SSL, add  DB_SSL=false  to your .env.
const { Pool } = require('pg');

const useSsl = process.env.DB_SSL !== 'false';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

module.exports = pool;