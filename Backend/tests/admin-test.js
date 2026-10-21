// =============================================================
// Backend/tests/admin-test.js  —  admin tools, maintenance, summary
// =============================================================
const { api, post, createUser, testCredentials, facilityId, dateOnWeekday, addMaintenanceBlock, check, finish } = require('./helpers');
const pool = require('../src/db');

async function main() {
  const admin = await createUser('admin');
  const student = await createUser('student');
  const other = await createUser('student');
  const basketball = await facilityId('Basketball Court');
  const football = await facilityId('Football Ground');
  const tuesday = dateOnWeekday(2);
  let r;

  console.log('Help and contact requests');
  r = await api('POST', '/support/requests', {
    name: 'Visitor Question',
    email: 'visitor@example.com',
    message: 'Could you tell me about facility access?',
  });
  check(
    'visitor can submit a support request and receive a ticket',
    r.status === 201 && /^CST-\d{4}-\d{6}$/.test(r.body.ticket_id) &&
      r.body.response_email === 'visitor@example.com' && r.body.status === 'pending_review',
    `got ${r.status} ${JSON.stringify(r.body)}`
  );
  r = await api('POST', '/support/requests', {
    name: 'No Message', email: 'visitor@example.com', message: ' ',
  });
  check('support requests reject an empty message', r.status === 400, `got ${r.status}`);
  r = await api('POST', '/support/requests', {
    name: 'Invalid Email', email: 'not-an-email', message: 'Question',
  });
  check('support requests reject an invalid response email', r.status === 400, `got ${r.status}`);
  r = await api('POST', '/support/requests', {
    test_user_id: student,
    name: 'Signed-in Question',
    email: 'student@example.com',
    message: 'Please contact me about my booking.',
  });
  check('signed-in support request submission succeeds', r.status === 201, `got ${r.status}`);
  const storedRequest = await pool.query(
    `SELECT user_id FROM support_requests WHERE email = $1 ORDER BY id DESC LIMIT 1`,
    ['student@example.com']
  );
  check('signed-in support request is associated with the user', storedRequest.rows[0]?.user_id === student);
  const invalidSessionResponse = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/support/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid-session-token',
    },
    body: JSON.stringify({
      name: 'Invalid Session',
      email: 'visitor@example.com',
      message: 'This should not be accepted with a bad session.',
    }),
  });
  check('support requests reject invalid session tokens', invalidSessionResponse.status === 401, `got ${invalidSessionResponse.status}`);

  console.log('Profile and account settings');
  r = await api('GET', '/auth/profile');
  check('profile settings require authentication', r.status === 401, `got ${r.status}`);
  r = await api('GET', '/auth/profile?test_user_id=' + student);
  check(
    'profile includes account details and default preferences',
    r.status === 200 && r.body.profile.id === student && r.body.preferences.booking_updates === true,
    `got ${r.status} ${JSON.stringify(r.body)}`
  );
  r = await api('PATCH', '/auth/profile', {
    test_user_id: student, full_name: 'Updated Test Student', contact_number: '+975 17123456', email: 'changed@example.com',
  });
  check(
    'user can update editable profile fields but not email',
    r.status === 200 && r.body.profile.full_name === 'Updated Test Student' &&
      r.body.profile.contact_number === '+975 17123456' && r.body.profile.email !== 'changed@example.com',
    `got ${r.status} ${JSON.stringify(r.body)}`
  );
  r = await api('PATCH', '/auth/profile', { test_user_id: student, full_name: ' ' });
  check('profile rejects an empty name', r.status === 400, `got ${r.status}`);
  r = await api('PATCH', '/auth/preferences', { test_user_id: student, game_reminders: false });
  check('user can update notification preferences', r.status === 200 && r.body.preferences.game_reminders === false, `got ${r.status}`);
  r = await api('GET', `/auth/profile?test_user_id=${student}`);
  check('notification preferences persist between profile loads', r.status === 200 && r.body.preferences.game_reminders === false, `got ${r.status}`);
  r = await api('PATCH', '/auth/preferences', { test_user_id: student, game_reminders: 'false' });
  check('notification preferences require boolean values', r.status === 400, `got ${r.status}`);
  await api('PATCH', '/auth/preferences', { test_user_id: other, maintenance_alerts: false });
  r = await api('PATCH', '/auth/preferences', { test_user_id: student, booking_updates: false });
  check('booking notification preference can be disabled', r.status === 200 && r.body.preferences.booking_updates === false, `got ${r.status}`);
  r = await api('PATCH', '/auth/password', { test_user_id: student, current_password: 'incorrect', new_password: 'new-password-123' });
  check('password change rejects an incorrect current password', r.status === 400, `got ${r.status}`);
  r = await api('PATCH', '/auth/password', {
    test_user_id: student,
    current_password: testCredentials(student).password,
    new_password: 'new-password-123',
  });
  check('user can change their password', r.status === 200, `got ${r.status}`);
  const passwordLogin = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testCredentials(student).email, password: 'new-password-123' }),
  });
  check('updated password can be used to sign in', passwordLogin.status === 200, `got ${passwordLogin.status}`);

  console.log('User notifications');
  const ownNotification = await pool.query(
    `INSERT INTO notifications (user_id, type, message)
     VALUES ($1, 'booking_confirmed', 'Test booking notification') RETURNING id`,
    [student]
  );
  const otherNotification = await pool.query(
    `INSERT INTO notifications (user_id, type, message)
     VALUES ($1, 'maintenance_scheduled', 'Another user notification') RETURNING id`,
    [other]
  );
  r = await api('GET', '/notifications');
  check('notifications require authentication', r.status === 401, `got ${r.status}`);
  r = await api('GET', `/notifications?test_user_id=${student}`);
  check(
    'a user sees only their own notifications',
    r.status === 200 && r.body.length === 1 && r.body[0].id === ownNotification.rows[0].id,
    `got ${r.status} ${JSON.stringify(r.body)}`
  );
  const notificationTimestamp = Date.parse(r.body[0]?.created_at);
  check(
    'notification timestamp is timezone-aware and close to current time',
    /(?:Z|[+-]\d{2}:\d{2})$/.test(r.body[0]?.created_at || '') &&
      Number.isFinite(notificationTimestamp) && Math.abs(Date.now() - notificationTimestamp) < 60000,
    `got ${r.body[0]?.created_at}`
  );
  r = await api('PATCH', `/notifications/${otherNotification.rows[0].id}/read`, { test_user_id: student });
  check('a user cannot mark another account notification as read', r.status === 404, `got ${r.status}`);
  r = await api('PATCH', `/notifications/${ownNotification.rows[0].id}/read`, { test_user_id: student });
  check('a user can mark their notification as read', r.status === 200 && r.body.notification.is_read, `got ${r.status}`);
  await pool.query(
    `INSERT INTO notifications (user_id, type, message) VALUES ($1, 'booking_rescheduled', 'Unread test notification')`,
    [student]
  );
  r = await api('PATCH', '/notifications/read-all', { test_user_id: student });
  check('mark all as read updates only the signed-in user notifications', r.status === 200 && r.body.updated === 1, `got ${r.status} ${JSON.stringify(r.body)}`);

  console.log('Admin-only routes');
  r = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/bookings?admin_user_id=${admin}`);
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
  let bookingNotice = await pool.query(
    `SELECT id FROM notifications WHERE user_id = $1 AND type = 'booking_confirmed'
     AND message = $2`,
    [student, `Your booking for ${tuesday} (16:00-17:00) is confirmed.`]
  );
  check('disabled booking updates suppress confirmation notices', bookingNotice.rows.length === 0);
  await api('PATCH', '/auth/preferences', { test_user_id: student, booking_updates: true });
  r = await api('PATCH', `/bookings/${id}/reschedule-request`, {
    booking_date: tuesday, start_time: '18:00', end_time: '19:00', reason: 'No authenticated user',
  });
  check('user rescheduling requires authentication', r.status === 401, `got ${r.status}`);
  r = await api('PATCH', `/bookings/${id}/reschedule-request`, {
    test_user_id: student, booking_date: tuesday, start_time: '18:00', end_time: '19:00', reason: 'Schedule changed',
  });
  check('an owner can reschedule their confirmed booking', r.status === 200 && r.body.booking.start_time === '18:00', `got ${r.status}`);
  const rescheduleNotification = await pool.query(
    `SELECT message FROM notifications WHERE user_id = $1 AND type = 'booking_rescheduled'
     ORDER BY id DESC LIMIT 1`,
    [student]
  );
  check('the reschedule reason is included in the notification', /Reason: Schedule changed/.test(rescheduleNotification.rows[0]?.message || ''));
  r = await api('PATCH', `/bookings/${id}/reschedule-request`, {
    test_user_id: other, booking_date: tuesday, start_time: '19:00', end_time: '20:00', reason: 'Wrong owner',
  });
  check('another user cannot reschedule the booking', r.status === 404, `got ${r.status}`);
  r = await api('PATCH', `/bookings/${id}/reschedule-request`, {
    test_user_id: student, booking_date: tuesday, start_time: '19:00', end_time: '20:00',
  });
  check('user rescheduling requires a reason', r.status === 400, `got ${r.status}`);
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

  const userCancellation = await post({
    user_id: student, facility_id: basketball, booking_date: tuesday, start_time: '19:00', end_time: '20:00',
  });
  r = await api('PATCH', `/bookings/${userCancellation.body.booking.id}/cancel`, { test_user_id: student });
  check('a user can cancel their own booking while authenticated', r.status === 200 && r.body.booking.status === 'cancelled', `got ${r.status}`);
  const userCancellationNotice = await pool.query(
    `SELECT type, message FROM notifications
     WHERE user_id = $1 AND type = 'booking_cancelled'
       AND message LIKE '%19:00-20:00%'
     ORDER BY id DESC LIMIT 1`,
    [student]
  );
  check(
    'cancelling a booking creates a booking-cancelled notification',
    userCancellationNotice.rows[0]?.type === 'booking_cancelled' &&
      userCancellationNotice.rows[0]?.message.includes('was cancelled'),
    userCancellationNotice.rows[0]?.message
  );

  console.log('Maintenance blocks');
  const wednesday = dateOnWeekday(3);
  await addMaintenanceBlock(basketball, wednesday, 'reflooring');
  r = await post({ user_id: student, facility_id: basketball, booking_date: wednesday, start_time: '16:00', end_time: '17:00' });
  check('booking inside a maintenance block is rejected', r.status === 400 && /maintenance/i.test(r.body.error), `got ${r.status} ${r.body.error}`);
  r = await api('GET', `/facilities/${basketball}/availability?date=${wednesday}`);
  check('availability reports the maintenance block', r.status === 200 && r.body.maintenance.length === 1, JSON.stringify(r.body.maintenance));
  await post({ user_id: student, facility_id: basketball, booking_date: tuesday, start_time: '19:00', end_time: '20:00' });
  r = await api('POST', '/maintenance', { admin_user_id: student, facility_id: basketball, start_date: tuesday, end_date: tuesday });
  check('a student cannot add a maintenance block', r.status === 403, `got ${r.status}`);
  r = await api('POST', '/maintenance', { admin_user_id: admin, facility_id: basketball, start_date: tuesday, end_date: tuesday, reason: 'admin test' });
  check('an admin can add a maintenance block', r.status === 201, `got ${r.status}`);
  check('maintenance block reports users notified', r.body.notified_users === 1, JSON.stringify(r.body));
  const studentMaintenanceNotice = await pool.query(
    `SELECT message FROM notifications WHERE user_id = $1 AND type = 'maintenance_scheduled'
     AND message LIKE '%admin test%'`,
    [student]
  );
  const optedOutMaintenanceNotice = await pool.query(
    `SELECT id FROM notifications WHERE user_id = $1 AND type = 'maintenance_scheduled'
     AND message LIKE '%admin test%'`,
    [other]
  );
  check('affected user receives maintenance alert with reason', studentMaintenanceNotice.rows.length === 1);
  check('maintenance preference opt-out is respected', optedOutMaintenanceNotice.rows.length === 0);
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