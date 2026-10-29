// =============================================================
// Backend/tests/rules-test.js  —  the DSA booking rules are enforced
// =============================================================
const { post, createUser, facilityId, dateOnWeekday, check, finish } = require('./helpers');

async function main() {
  const student = await createUser('student');
  const faculty = await createUser('faculty');
  const outsider = await createUser('outsider');
  const football = await facilityId('Football Ground');
  const basketball = await facilityId('Basketball Court');
  const volleyball = await facilityId('Volleyball Court (Male)');
  const badminton = await facilityId('Badminton Court 1');
  const tableTennis = await facilityId('Table Tennis Table 1');
  const archery = await facilityId('Archery Range');

  const monday = dateOnWeekday(1);
  const tuesday = dateOnWeekday(2);
  const wednesday = dateOnWeekday(3);
  const thursday = dateOnWeekday(4);
  const saturday = dateOnWeekday(6);
  const sunday = dateOnWeekday(0);
  const book = (user_id, facility_id, booking_date, start_time, end_time) =>
    post({ user_id, facility_id, booking_date, start_time, end_time });

  console.log('Football (DSA schedule)');
  let r = await book(outsider, football, tuesday, '16:00', '18:00');
  check('outsider cannot book the student slot (Tue 4-6pm)', r.status === 403, `got ${r.status}`);
  r = await book(student, football, tuesday, '16:00', '18:00');
  check('student can book the student slot (Tue 4-6pm)', r.status === 201, `got ${r.status}`);
  r = await book(student, football, tuesday, '18:00', '20:00');
  check('student cannot book the commercial slot (Tue 6-8pm)', r.status === 403, `got ${r.status}`);
  r = await book(outsider, football, tuesday, '18:00', '20:00');
  check('outsider can book the commercial slot (Tue 6-8pm)', r.status === 201, `got ${r.status}`);
  r = await book(student, football, monday, '16:00', '18:00');
  check('student cannot book maintenance Monday', r.status === 403, `got ${r.status}`);
  r = await book(student, football, thursday, '18:00', '20:00');
  check('student cannot book the faculty slot (Thu 6-8pm)', r.status === 403, `got ${r.status}`);
  r = await book(faculty, football, thursday, '18:00', '20:00');
  check('faculty can book the faculty slot (Thu 6-8pm)', r.status === 201, `got ${r.status}`);
  r = await book(student, football, tuesday, '10:00', '12:00');
  check('football on a weekday 8am-4pm is unavailable', r.status === 400, `got ${r.status}`);
  r = await book(student, football, tuesday, '06:00', '08:00');
  check('football 6-8am free student slot still works on a weekday', r.status === 201, `got ${r.status}`);
  r = await book(student, football, saturday, '08:00', '10:00');
  check('student can book Saturday morning (before 4pm)', r.status === 201, `got ${r.status}`);
  r = await book(student, football, saturday, '16:00', '18:00');
  check('student cannot book Saturday evening (commercial)', r.status === 403, `got ${r.status}`);
  // Standard timetable (no tournament period covers these dates in the test DB)
  r = await book(student, football, tuesday, '20:00', '22:00');
  check('standard: student cannot book Tue 8-10pm (hiring)', r.status === 403, `got ${r.status}`);
  r = await book(outsider, football, tuesday, '20:00', '22:00');
  check('standard: outsider can book Tue 8-10pm (hiring)', r.status === 201, `got ${r.status}`);
  r = await book(student, football, wednesday, '16:00', '18:00');
  check('standard: Wed 4-6pm is reserved for female students (student blocked until gender exists)', r.status === 403, `got ${r.status}`);
  r = await book(student, football, saturday, '12:00', '14:00');
  check('football Saturday 12-4pm is not bookable', r.status === 400, `got ${r.status}`);
  // Sunday: 4 slots listed but only 3 bookings, then the day closes
  r = await book(student, football, sunday, '06:00', '08:00');
  check('Sunday student match 1 of 3', r.status === 201, `got ${r.status}`);
  r = await book(student, football, sunday, '08:00', '10:00');
  check('Sunday student match 2 of 3', r.status === 201, `got ${r.status}`);
  r = await book(student, football, sunday, '10:00', '12:00');
  check('Sunday student match 3 of 3', r.status === 201, `got ${r.status}`);
  r = await book(student, football, sunday, '14:00', '16:00');
  check('Sunday 4th student booking is refused (daily cap of 3)', r.status === 409, `got ${r.status}`);

  console.log('Other sports (weekdays 4-10pm; weekends 8am-10pm)');
  r = await book(student, basketball, tuesday, '10:00', '11:00');
  check('outside operating hours (4-10pm) is rejected', r.status === 400, `got ${r.status}`);
  r = await book(outsider, basketball, thursday, '09:00', '10:00');
  check('weekday morning (8am-4pm) is unavailable for everyone', r.status === 400, `got ${r.status}`);
  r = await book(student, basketball, tuesday, '17:00', '19:00');
  check('2-hour booking on basketball is rejected (1-hour limit)', r.status === 400, `got ${r.status}`);
  r = await book(faculty, basketball, tuesday, '17:00', '18:00');
  check('faculty cannot book basketball (DSA: students + commercial)', r.status === 403, `got ${r.status}`);
  r = await book(faculty, basketball, saturday, '08:00', '09:00');
  check('faculty can book basketball Saturday morning', r.status === 201, `got ${r.status}`);
  r = await book(student, volleyball, saturday, '08:00', '09:00');
  check('student can book volleyball Saturday morning', r.status === 201, `got ${r.status}`);
  r = await book(outsider, badminton, sunday, '08:00', '09:00');
  check('outsider can book badminton Sunday morning', r.status === 201, `got ${r.status}`);
  r = await book(faculty, tableTennis, sunday, '21:00', '22:00');
  check('faculty can book table tennis Sunday evening', r.status === 201, `got ${r.status}`);

  console.log('Archery (all roles, weekdays 4-10pm, weekends 8am-10pm)');
  r = await book(student, archery, monday, '16:00', '18:00');
  check('student can book archery 4-6pm', r.status === 201, `got ${r.status}`);
  r = await book(faculty, archery, tuesday, '16:00', '18:00');
  check('faculty can book archery 4-6pm', r.status === 201, `got ${r.status}`);
  r = await book(outsider, archery, thursday, '16:00', '18:00');
  check('outsider can book archery 4-6pm', r.status === 201, `got ${r.status}`);
  r = await book(student, archery, tuesday, '10:00', '12:00');
  check('archery is unavailable on weekdays before 4pm', r.status === 400, `got ${r.status}`);
  r = await book(student, archery, saturday, '08:00', '10:00');
  check('student can book archery Saturday morning', r.status === 201, `got ${r.status}`);
  r = await book(faculty, archery, saturday, '20:00', '22:00');
  check('faculty can book archery Saturday evening', r.status === 201, `got ${r.status}`);
  r = await book(outsider, archery, sunday, '08:00', '10:00');
  check('outsider can book archery Sunday morning', r.status === 201, `got ${r.status}`);
  r = await book(student, archery, sunday, '20:00', '22:00');
  check('student can book archery Sunday evening', r.status === 201, `got ${r.status}`);

  console.log('Input checks');
  r = await book(student, basketball, '2020-01-07', '16:00', '17:00');
  check('a date in the past is rejected', r.status === 400, `got ${r.status}`);
  r = await book(student, basketball, tuesday, '18:00', '17:00');
  check('end before start is rejected', r.status === 400, `got ${r.status}`);
  r = await book(student, basketball, 'not-a-date', '16:00', '17:00');
  check('a malformed date is rejected', r.status === 400, `got ${r.status}`);
  r = await book(999999999, basketball, tuesday, '16:00', '17:00');
  check('an unknown user without a valid session is rejected', r.status === 401, `got ${r.status}`);
}

main()
  .catch((err) => check('test run completed without errors', false, err.message))
  .then(finish);