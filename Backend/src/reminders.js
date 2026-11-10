const pool = require('./db');

async function expirePastPendingBookings() {
  const result = await pool.query(
    `WITH expired AS (
       UPDATE bookings
       SET status = 'expired'
       WHERE status = 'pending'
         AND ((booking_date + start_time) AT TIME ZONE 'Asia/Thimphu') <= now()
       RETURNING id, user_id, facility_id, booking_date, start_time, payment_amount,
                 payment_screenshot
     ),
     notices AS (
       INSERT INTO notifications (user_id, type, message)
       SELECT e.user_id, 'payment_resolution_required',
              'Your paid booking for ' || f.name || ' on ' ||
              to_char(e.booking_date, 'FMDD Mon YYYY') || ' was not approved before it started and has expired. Choose a full refund or booking credit in My Bookings. The DSA will arrange your choice.'
       FROM expired e
       JOIN facilities f ON f.id = e.facility_id
       WHERE e.payment_amount IS NOT NULL AND e.payment_screenshot IS NOT NULL
       RETURNING id
     )
     SELECT (SELECT count(*) FROM expired)::int AS expired_count,
            (SELECT count(*) FROM notices)::int AS notified_count`,
  );
  const expiredCount = result.rows[0]?.expired_count || 0;
  if (expiredCount > 0) {
    console.log(`Marked ${expiredCount} past pending booking(s) as expired.`);
  }
  return expiredCount;
}

async function processDueReminders() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const due = await client.query(
      `WITH candidates AS (
         SELECT b.id AS booking_id,
                b.user_id,
                ((b.booking_date + b.start_time) AT TIME ZONE 'Asia/Thimphu') AS scheduled_for,
                lead_hours.value AS lead_hours
         FROM bookings b
         CROSS JOIN (VALUES (24::smallint), (2::smallint)) AS lead_hours(value)
         LEFT JOIN user_notification_preferences p ON p.user_id = b.user_id
         WHERE b.status = 'approved'
           AND COALESCE(p.game_reminders, true) = true
           AND ((b.booking_date + b.start_time) AT TIME ZONE 'Asia/Thimphu') > now()
           AND ((b.booking_date + b.start_time) AT TIME ZONE 'Asia/Thimphu')
             <= now() + make_interval(hours => lead_hours.value)
       ),
       inserted AS (
         INSERT INTO booking_reminders (booking_id, scheduled_for, lead_hours)
         SELECT booking_id, scheduled_for, lead_hours
         FROM candidates
         ON CONFLICT (booking_id, scheduled_for, lead_hours) DO NOTHING
         RETURNING id, booking_id, scheduled_for, lead_hours
       )
       SELECT inserted.id, inserted.booking_id, inserted.scheduled_for,
              inserted.lead_hours, b.user_id, f.name AS facility_name
       FROM inserted
       JOIN bookings b ON b.id = inserted.booking_id
       JOIN facilities f ON f.id = b.facility_id`,
    );

    for (const reminder of due.rows) {
      const localTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Thimphu',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(reminder.scheduled_for);
      await client.query(
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, 'booking_reminder', $2)`,
        [
          reminder.user_id,
          `Reminder: your ${reminder.facility_name} booking is scheduled for ${localTime} (Bhutan time).`,
        ],
      );
    }

    await client.query('COMMIT');
    if (due.rows.length > 0) console.log(`Created ${due.rows.length} booking reminder(s).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteExpiredNotifications() {
  const result = await pool.query(
    `DELETE FROM notifications
     WHERE created_at < now() - INTERVAL '7 days'`,
  );
  if (result.rowCount > 0) {
    console.log(`Deleted ${result.rowCount} expired notification(s).`);
  }
}

function startReminderScheduler() {
  let running = false;
  let nextNotificationCleanup = 0;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await expirePastPendingBookings();
    } catch (error) {
      console.error('Pending booking expiration failed:', error);
    }

    try {
      await processDueReminders();
    } catch (error) {
      console.error('Booking reminder processing failed:', error);
    }

    if (Date.now() >= nextNotificationCleanup) {
      try {
        await deleteExpiredNotifications();
        nextNotificationCleanup = Date.now() + 24 * 60 * 60 * 1000;
      } catch (error) {
        console.error('Notification retention cleanup failed:', error);
      }
    }

    running = false;
  };

  void run();
  return setInterval(run, 60 * 1000);
}

module.exports = {
  expirePastPendingBookings,
  processDueReminders,
  deleteExpiredNotifications,
  startReminderScheduler,
};
