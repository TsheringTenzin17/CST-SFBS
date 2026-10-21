const pool = require('./db');

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

function startReminderScheduler() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processDueReminders();
    } catch (error) {
      console.error('Booking reminder processing failed:', error);
    } finally {
      running = false;
    }
  };

  void run();
  return setInterval(run, 60 * 1000);
}

module.exports = { processDueReminders, startReminderScheduler };
