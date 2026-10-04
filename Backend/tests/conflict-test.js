// Fires 5 simultaneous booking requests for the exact same slot and
// checks that exactly 1 succeeds and the other 4 are correctly
// rejected as conflicts. This is Objective O3's actual success measure.
require('dotenv').config();
const pool = require('../src/db');

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function main() {
  const email = `conflict-test-${Date.now()}@cst.edu.bt`;
  const userResult = await pool.query(
    `INSERT INTO users (full_name, email, role, password_hash) VALUES ($1, $2, 'student', 'placeholder') RETURNING id`,
    ['Conflict Test User', email]
  );
  const userId = userResult.rows[0].id;

  const booking = {
    user_id: userId,
    facility_id: 2, // Basketball Court — 'any' role, 4-10pm every day
    booking_date: '2026-10-10',
    start_time: '16:00',
    end_time: '17:00',
  };

  console.log('Firing 5 simultaneous requests for the same slot...');
  const attempts = Array.from({ length: 5 }, () =>
    fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    }).then((res) => res.json().then((body) => ({ status: res.status, body })))
  );

  const results = await Promise.all(attempts);
  const successes = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);

  console.log(`Successes: ${successes.length}, Conflicts: ${conflicts.length}`);
  if (successes.length === 1 && conflicts.length === 4) {
    console.log('PASS: exactly one booking succeeded, the rest were correctly rejected.');
  } else {
    console.log('FAIL — expected 1 success and 4 conflicts. Full results:');
    console.log(JSON.stringify(results, null, 2));
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});