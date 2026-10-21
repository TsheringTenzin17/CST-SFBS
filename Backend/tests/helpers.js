// =============================================================
// Backend/tests/helpers.js  —  shared tools for all test files
// =============================================================
// Every test creates its OWN users and dates, and finish() deletes everything
// afterwards, so tests can be re-run any number of times on the shared
// database without leaving junk behind or colliding with each other.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db');

const API_URL = process.env.API_URL || 'http://localhost:4000';
const created = { users: [], blocks: [] };
const credentials = new Map();
const sessions = new Map();
let failures = 0;

// ---- calling the API -------------------------------------------------------
async function api(method, path, body) {
  let adminId = body && (body.admin_user_id || body.test_user_id);
  if (!adminId) {
    const query = path.match(/[?&](?:admin_user_id|test_user_id)=(\d+)/);
    if (query) adminId = query[1];
  }
    const requestBody = body && { ...body };
    if (requestBody) {
      delete requestBody.admin_user_id;
      delete requestBody.test_user_id;
    }
    const token = adminId ? await sessionToken(adminId) : null;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: requestBody ? JSON.stringify(requestBody) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const post = (body) => api('POST', '/bookings', body);

async function sessionToken(userId) {
  if (sessions.has(Number(userId))) return sessions.get(Number(userId));
  const account = credentials.get(Number(userId));
  if (!account) throw new Error(`No test credentials for user ${userId}`);
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) throw new Error(data.error || 'Could not authenticate test user');
  sessions.set(Number(userId), data.token);
  return data.token;
}

// ---- test data ---------------------------------------------------------------
async function createUser(role) {
  const email = `test-${role}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = `test-password-${Math.random()}`;
  const r = await pool.query(
    `INSERT INTO users (full_name, email, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
    [`Test ${role}`, email, role, await bcrypt.hash(password, 10)]
  );
  const id = r.rows[0].id;
  created.users.push(id);
  credentials.set(id, { email, password });
  return id;
}

function testCredentials(userId) {
  return credentials.get(Number(userId));
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

module.exports = { api, post, createUser, testCredentials, facilityId, dateOnWeekday, addMaintenanceBlock, check, finish };