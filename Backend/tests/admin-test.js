// =============================================================
// Backend/tests/admin-test.js  —  admin tools, maintenance, summary
// =============================================================
const { api, post, createUser, facilityId, dateOnWeekday, addMaintenanceBlock, check, finish } = require('./helpers');
const pool = require('../src/db');

async function main() {
  const admin = await createUser('admin');
  const student = await createUser('student');
  const other = await createUser('student');
  const basketball = await facilityId('Basketball Court');
  const football = await facilityId('Football Ground');
  const tuesday = dateOnWeekday(2);

  console.log('Admin-only routes');
  let r = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/bookings?admin_user_id=${admin}`);
  check('a caller cannot access admin bookings by supplying an admin ID', r.status === 401, `got ${r.status}`);
  r = await api('GET', `/bookings?admin_user_id=${student}`);
  check('a student cannot list all bookings', r.status === 403, `got ${r.status}`);
  r = await api('GET', `/bookings?admin_user_id=${admin}`);
  check('an admin can list all bookings', r.status === 200 && Array.isArray(r.body), `got ${r.status}`);
  r = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/admin/users?admin_user_id=${admin}`);
  check('a caller cannot list users by supplying an admin ID', r.status === 401, `got ${r.status}`);
  r = await api('GET', `/admin/users?admin_user_id=${student}`);
  check('a student cannot list users', r.status === 403, `got ${r.status}`);
  r = await api('GET', `/admin/users?admin_user_id=${admin}`);
  check('an admin can list users, with no password data', r.status === 200 && !JSON.stringify(r.body).includes('password'), `got ${r.status}`);
  r = await api('GET', `/admin/reports?admin_user_id=${admin}`);
  check('an admin can load reports', r.status === 200 && r.body.totals !== undefined, `got ${r.status}`);

  console.log('Admin cancel + reschedule');
  const made = await post({ user_id: student, facility_id: basketball, booking_date: tuesday, start_time: '16:00', end_time: '17:00' });
  const id = made.body.booking.id;
  r = await api('PATCH', `/bookings/${id}/reschedule`, { admin_user_id: student, booking_date: tuesday, start_time: '18:00', end_time: '19:00' });
  check('a student cannot reschedule', r.status === 403, `got ${r.status}`);
  r = await api('PATCH', `/bookings/${id}/reschedule`, { admin_user_id: admin, booking_date: tuesday, start_time: '18:00', end_time: '19:00' });
  check('an admin can reschedule to a free slot', r.status === 200, `got ${r.status}`);
  await post({ user_id: other, facility_id: basketball, booking_date: tuesday, start_time: '20:00', end_time: '21:00' });
  r = await api('PATCH', `/bookings/${id}/reschedule`, { admin_user_id: admin, booking_date: tuesday, start_time: '20:00', end_time: '21:00' });
  check('rescheduling onto a taken slot -> 409', r.status === 409, `got ${r.status}`);
  r = await api('PATCH', `/bookings/${id}/reschedule`, { admin_user_id: admin, booking_date: tuesday, start_time: '07:00', end_time: '08:00' });
  check('rescheduling outside opening hours -> 400', r.status === 400, `got ${r.status}`);
  r = await api('PATCH', `/bookings/${id}`, { status: 'cancelled', admin_user_id: admin });
  check('cancellation requires a reason', r.status === 400, `got ${r.status}`);
  r = await api('PATCH', `/bookings/${id}`, { status: 'cancelled', admin_user_id: admin, reason: 'test cancellation' });
  check('an admin can cancel any booking', r.status === 200, `got ${r.status}`);
  const notification = await pool.query(
    `SELECT message FROM notifications WHERE user_id = $1 AND type = 'booking_cancelled'
     ORDER BY id DESC LIMIT 1`,
    [student]
  );
  check('cancellation reason is included in the user notification', notification.rows[0]?.message.includes('Reason: test cancellation'), notification.rows[0]?.message);
  r = await post({ user_id: other, facility_id: basketball, booking_date: tuesday, start_time: '18:00', end_time: '19:00' });
  check('a cancelled booking frees its slot', r.status === 201, `got ${r.status}`);

  console.log('Maintenance blocks');
  const wednesday = dateOnWeekday(3);
  await addMaintenanceBlock(basketball, wednesday, 'reflooring');
  r = await post({ user_id: student, facility_id: basketball, booking_date: wednesday, start_time: '16:00', end_time: '17:00' });
  check('booking inside a maintenance block is rejected', r.status === 400 && /maintenance/i.test(r.body.error), `got ${r.status} ${r.body.error}`);
  r = await api('GET', `/facilities/${basketball}/availability?date=${wednesday}`);
  check('availability reports the maintenance block', r.status === 200 && r.body.maintenance.length === 1, JSON.stringify(r.body.maintenance));
  r = await api('POST', '/maintenance', { admin_user_id: student, facility_id: basketball, start_date: tuesday, end_date: tuesday });
  check('a student cannot add a maintenance block', r.status === 403, `got ${r.status}`);
  r = await api('POST', '/maintenance', { admin_user_id: admin, facility_id: basketball, start_date: tuesday, end_date: tuesday, reason: 'admin test' });
  check('an admin can add a maintenance block', r.status === 201, `got ${r.status}`);
  const apiBlockId = r.body.id;
  r = await api('GET', `/facilities/${basketball}/availability?date=${tuesday}`);
  check('a maintenance block closes availability for that date', r.status === 200 && r.body.maintenance.length > 0, `got ${r.status}`);
  r = await api('DELETE', `/maintenance/${apiBlockId}`, { admin_user_id: admin });
  check('an admin can remove a maintenance block', r.status === 200, `got ${r.status}`);

  console.log('Availability summary (real slot counts)');
  const date = dateOnWeekday(2);
  r = await api('GET', `/facilities/summary?date=${date}`);
  const bb = r.body.facilities && r.body.facilities.find((f) => f.facility_id === basketball);
  check('summary lists basketball with 6 slots (4-10pm, 1h)', bb && bb.total === 6, JSON.stringify(bb));
  const fb = r.body.facilities && r.body.facilities.find((f) => f.facility_id === football);
  check('football on a Tuesday has 3 bookable 2-hour slots + morning slot', fb && fb.total === 4, JSON.stringify(fb));
  await post({ user_id: student, facility_id: basketball, booking_date: date, start_time: '16:00', end_time: '17:00' });
  r = await api('GET', `/facilities/summary?date=${date}`);
  const after = r.body.facilities.find((f) => f.facility_id === basketball);
  check('booking one slot lowers the free count by 1', after.available === bb.available - 1, JSON.stringify(after));
  r = await api('GET', `/facilities/summary?date=${wednesday}`);
  const blocked = r.body.facilities.find((f) => f.facility_id === basketball);
  check('a maintenance day shows 0 free slots', blocked.available === 0 && blocked.blocked === true, JSON.stringify(blocked));

  console.log('Role changes');
  r = await api('PATCH', `/admin/users/${student}/role`, { admin_user_id: admin, role: 'faculty' });
  check('an admin can change a role', r.status === 200 && r.body.user.role === 'faculty', `got ${r.status}`);
  r = await api('PATCH', `/admin/users/${admin}/role`, { admin_user_id: admin, role: 'student' });
  check('an admin cannot remove their own admin role', r.status === 400, `got ${r.status}`);
}

main()
  .catch((err) => check('test run completed without errors', false, err.message))
  .then(finish);