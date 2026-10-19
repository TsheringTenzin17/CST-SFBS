// =============================================================
// Backend/tests/helpers.js  —  shared tools for all test files
// =============================================================
// Every test creates its OWN users and dates, and finish() deletes everything
// afterwards, so tests can be re-run any number of times on the shared
// database without leaving junk behind or colliding with each other.
require('dotenv').config();
const pool = require('../src/db');

const API_URL = process.env.API_URL || 'http://localhost:4000';
const created = { users: [], blocks: [] };
let failures = 0;

// ---- calling the API -------------------------------------------------------
async function api(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const post = (body) => api('POST', '/bookings', body);

// ---- test data ---------------------------------------------------------------
async function createUser(role) {
  const email = `test-${role}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const r = await pool.query(
    `INSERT INTO users (full_name, email, role, password_hash) VALUES ($1, $2, $3, 'test-only') RETURNING id`,
    [`Test ${role}`, email, role]
  );
  created.users.push(r.rows[0].id);
  return r.rows[0].id;
}

async function facilityId(name) {
  const r = await pool.query('SELECT id FROM facilities WHERE name = $1', [name]);
  if (r.rows.length === 0) throw new Error(`Facility not found: ${name}`);
  return r.rows[0].id;
}

// A random date in 2027 that falls on the given weekday (0=Sun ... 6=Sat).
function dateOnWeekday(dow) {
  const d = new Date(Date.UTC(2027, 0, 1));
  d.setUTCDate(d.getUTCDate() + Math.floor(Math.random() * 40) * 7);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function addMaintenanceBlock(facility_id, date, reason = 'test block') {
  const r = await pool.query(
    `INSERT INTO maintenance_blocks (facility_id, start_date, end_date, reason) VALUES ($1, $2, $2, $3) RETURNING id`,
    [facility_id, date, reason]
  );
  created.blocks.push(r.rows[0].id);
}

// ---- reporting ---------------------------------------------------------------
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '   -> ' + detail}`);
  if (!ok) failures += 1;
}

// Cleans up, prints the verdict and ends the process (exit code 1 on failure).
async function finish() {
  try {
    if (created.users.length > 0) {
      await pool.query('DELETE FROM notifications WHERE user_id = ANY($1)', [created.users]);
      await pool.query('DELETE FROM bookings WHERE user_id = ANY($1)', [created.users]);
    }
    if (created.blocks.length > 0) await pool.query('DELETE FROM maintenance_blocks WHERE id = ANY($1)', [created.blocks]);
    if (created.users.length > 0) await pool.query('DELETE FROM users WHERE id = ANY($1)', [created.users]);
  } finally {
    await pool.end();
  }
  console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

module.exports = { api, post, createUser, facilityId, dateOnWeekday, addMaintenanceBlock, check, finish };