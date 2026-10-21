// =============================================================
// Backend/src/db/run-sql.js  —  run SQL without installing psql
// =============================================================
//   node src/db/run-sql.js src/db/booking-hardening.sql
//   node src/db/run-sql.js --sql "SELECT COUNT(*) FROM users"
require('dotenv').config();
const fs = require('fs');
const pool = require('../db');

const args = process.argv.slice(2);
const sql = args[0] === '--sql' ? args[1] : args[0] ? fs.readFileSync(args[0], 'utf8') : null;

if (!sql) {
  console.error('Usage: node src/db/run-sql.js <file.sql>   OR   node src/db/run-sql.js --sql "<statement>"');
  process.exit(1);
}

pool.query(sql)
  .then((result) => {
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    if (last && last.rows && last.rows.length > 0) console.table(last.rows);
    if (last && last.command && last.command !== 'SELECT' && last.rowCount != null) console.log(`${last.command}: ${last.rowCount} row(s) affected`);
    console.log('Done.');
  })
  .catch((err) => console.error('Failed:', err.message))
  .finally(() => pool.end());