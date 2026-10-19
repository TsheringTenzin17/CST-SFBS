// =============================================================
// Backend/tests/conflict-test.js  —  Objective O3: zero double bookings
// =============================================================
const { api, post, createUser, facilityId, dateOnWeekday, check, finish } = require('./helpers');

async function main() {
  const alice = await createUser('student');
  const bob = await createUser('student');
  const date = dateOnWeekday(2); // a Tuesday
  const basketball = await facilityId('Basketball Court');
  const slot = { user_id: alice, facility_id: basketball, booking_date: date, start_time: '16:00', end_time: '17:00' };

  // ---- Test 1: 5 requests for the SAME slot at the SAME moment -------------
  console.log('Test 1: 5 simultaneous requests for one slot');
  const results = await Promise.all(Array.from({ length: 5 }, () => post(slot)));
  const statuses = results.map((r) => r.status);
  const successes = statuses.filter((s) => s === 201).length;
  const conflicts = statuses.filter((s) => s === 409).length;
  console.log(`  successes: ${successes}, conflicts: ${conflicts}`);
  check('exactly 1 of 5 succeeds', successes === 1, `statuses: ${statuses}`);
  check('the other 4 get 409 Conflict', conflicts === 4, `statuses: ${statuses}`);

  // ---- Test 2: a PARTLY overlapping slot is also refused --------------------
  console.log('Test 2: overlapping times');
  const r2 = await post({ ...slot, user_id: bob, start_time: '16:30', end_time: '17:30' });
  check('16:30-17:30 overlaps the 16:00-17:00 booking -> 409', r2.status === 409, `got ${r2.status}`);
  const r2b = await post({ ...slot, user_id: bob, start_time: '17:00', end_time: '18:00' });
  check('17:00-18:00 is right after it -> allowed', r2b.status === 201, `got ${r2b.status}`);

  // ---- Test 3: two DIFFERENT courts at the same time both succeed ----------
  console.log('Test 3: two courts, same time');
  const court1 = await facilityId('Badminton Court 1');
  const court2 = await facilityId('Badminton Court 2');
  const [c1, c2] = await Promise.all([
    post({ ...slot, facility_id: court1 }),
    post({ ...slot, user_id: bob, facility_id: court2 }),
  ]);
  check('Badminton Court 1 books', c1.status === 201, `got ${c1.status}`);
  check('Badminton Court 2 books at the same time', c2.status === 201, `got ${c2.status}`);

  // ---- Test 4: cancelling frees the slot -------------------------------------
  console.log('Test 4: cancel then re-book');
  const first = await post({ ...slot, facility_id: await facilityId('Volleyball Court (Male)') });
  check('first booking succeeds', first.status === 201, `got ${first.status}`);
  const id = first.body.booking && first.body.booking.id;
  const wrong = await api('PATCH', `/bookings/${id}/cancel`, { user_id: bob });
  check("another user cannot cancel it -> 404", wrong.status === 404, `got ${wrong.status}`);
  const cancel = await api('PATCH', `/bookings/${id}/cancel`, { user_id: alice });
  check('the owner can cancel it', cancel.status === 200, `got ${cancel.status}`);
  const again = await post({ ...slot, user_id: bob, facility_id: await facilityId('Volleyball Court (Male)') });
  check('the freed slot can be booked again', again.status === 201, `got ${again.status}`);
}

main()
  .catch((err) => check('test run completed without errors', false, err.message))
  .then(finish);