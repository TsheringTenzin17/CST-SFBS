// =============================================================
// Backend/src/db.js  —  PostgreSQL connection pool
// =============================================================
// Reads DATABASE_URL from Backend/.env (never commit that file).
// Render's database needs SSL. If you ever run a LOCAL Postgres that
// has no SSL, add  DB_SSL=false  to your .env.
const { Pool } = require('pg');

const useSsl = process.env.DB_SSL !== 'false';
const connectionUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;

if (connectionUrl) {
  for (const parameter of [
    'ssl',
    'sslmode',
    'sslcert',
    'sslkey',
    'sslrootcert',
    'sslpassword',
    'uselibpqcompat',
  ]) {
    connectionUrl.searchParams.delete(parameter);
  }
}

const pool = new Pool({
  connectionString: connectionUrl?.toString(),
  ssl: useSsl
    ? {
        rejectUnauthorized: true,
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
      }
    : false,
});

module.exports = pool;
