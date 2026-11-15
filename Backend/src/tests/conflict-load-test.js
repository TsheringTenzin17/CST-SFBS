// Extra O3 evidence: 20 and 50 simultaneous requests from different users for ONE slot.
const { post, createUser, facilityId, dateOnWeekday, check, finish } = require('./helpers');
const pool = require('../src/db');

async function round(n, date, start, end, facility) {
  const users = await Promise.all(Array.from({ length: n }, () => createUser('student')));
  const res = await Promise.all(
    users.map((u) => post({ user_id: u, facility_id: facility, booking_date: date, start_time: start, end_time: end })),
  );
  const ok = res.filter((r) => r.status === 201).length;
  const conflict = res.filter((r) => r.status === 409).length;
  const rows = await pool.query(
    `SELECT count(*)::int AS n FROM bookings WHERE facility_id=$1 AND booking_date=$2 AND start_time=$3 AND status <> 'cancelled'`,
    [facility, date, start],
  );
  console.log(`  ${n} requests: ${ok} created, ${conflict} conflicts, ${rows.rows[0].n} row(s) in database`);
  check(`${n} simultaneous requests: exactly 1 succeeds`, ok === 1);
  check(`${n} simultaneous requests: the other ${n - 1} get 409`, conflict === n - 1);
  check(`${n} simultaneous requests: exactly 1 row stored`, rows.rows[0].n === 1);
}

async function main() {
  const f = await facilityId('Basketball Court');
  const date = dateOnWeekday(3);
  await round(20, date, '16:00', '17:00', f);
  await round(50, date, '17:00', '18:00', f);
}
main().catch((e) => check('run completed', false, e.message)).then(finish);
