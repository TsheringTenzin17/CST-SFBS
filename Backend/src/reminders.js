// ==============================================================
// IMPORTS - load the helper files we need
// ==============================================================
const pool = require('./db');                               // database connection pool

// ==============================================================
// expirePastPendingBookings - expire pending bookings that already started
// ==============================================================
async function expirePastPendingBookings() {                // gives back how many expired
  // ----------------------------------------------------------
  // run the query
  // ----------------------------------------------------------
  // expired: mark pending bookings whose start time has passed
  // notices: tell users who paid to pick a refund or credit
  // last select: count how many expired and how many were told
  const result = await pool.query(                          // run the big query
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
  );                                                        // end of query

  // ----------------------------------------------------------
  // show the result
  // ----------------------------------------------------------
  const expiredCount = result.rows[0]?.expired_count || 0;  // how many expired, or 0
  if (expiredCount > 0) {                                   // at least one expired
    // show a message in the terminal
    console.log(`Marked ${expiredCount} past pending booking(s) as expired.`);
  }                                                         // end of if
  return expiredCount;                                      // give the number back
}                                                           // end of function

// ==============================================================
// processDueReminders - make reminders for bookings that start soon
// ==============================================================
async function processDueReminders() {                      // no value given back
  // ----------------------------------------------------------
  // start the transaction so everything saves together
  // ----------------------------------------------------------
  const client = await pool.connect();                      // get one db connection
  try {                                                     // catch errors below
    await client.query('BEGIN');                            // start transaction

    // ----------------------------------------------------------
    // find the reminders that are due
    // ----------------------------------------------------------
    // candidates: approved bookings starting within 24 or 2 hours, user has reminders on
    // inserted: save each reminder once, skip ones that already exist
    // last select: get the booking, user and facility name for each new reminder
    const due = await client.query(                         // run the big query
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
    );                                                      // end of query

    // ----------------------------------------------------------
    // send a notification for each reminder
    // ----------------------------------------------------------
    for (const reminder of due.rows) {                      // go through each reminder
      const localTime = new Intl.DateTimeFormat('en-GB', {  // make a readable time
        timeZone: 'Asia/Thimphu',                           // use bhutan time
        dateStyle: 'medium',                                // short date like 5 Nov 2026
        timeStyle: 'short',                                 // short time like 16:00
      }).format(reminder.scheduled_for);                    // format the booking time
      await client.query(                                   // save the notification
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, 'booking_reminder', $2)`,
        [                                                   // values for $1 and $2
          reminder.user_id,                                 // the user who gets it
          // the message text with facility and time
          `Reminder: your ${reminder.facility_name} booking is scheduled for ${localTime} (Bhutan time).`,
        ],                                                  // end of values
      );                                                    // end of insert
    }                                                       // end of loop

    // ----------------------------------------------------------
    // save everything
    // ----------------------------------------------------------
    await client.query('COMMIT');                           // save all changes
    // show a message only if some reminders were made
    if (due.rows.length > 0) console.log(`Created ${due.rows.length} booking reminder(s).`);
  } catch (error) {                                         // something went wrong
    await client.query('ROLLBACK');                         // undo everything
    throw error;                                            // pass the error on
  } finally {                                               // always runs at the end
    client.release();                                       // give connection back to pool
  }                                                         // end of try
}                                                           // end of function

// ==============================================================
// deleteExpiredNotifications - remove notifications older than 7 days
// ==============================================================
async function deleteExpiredNotifications() {               // no value given back
  // delete every notification older than 7 days
  const result = await pool.query(                          // run the delete
    `DELETE FROM notifications
     WHERE created_at < now() - INTERVAL '7 days'`,
  );                                                        // end of delete
  if (result.rowCount > 0) {                                // some rows were deleted
    // show a message in the terminal
    console.log(`Deleted ${result.rowCount} expired notification(s).`);
  }                                                         // end of if
}                                                           // end of function

// ==============================================================
// startReminderScheduler - run all the jobs again and again
// ==============================================================
function startReminderScheduler() {                         // call this once when server starts
  // ----------------------------------------------------------
  // helper values
  // ----------------------------------------------------------
  let running = false;                                      // true while a run is going
  let nextNotificationCleanup = 0;                          // time of the next cleanup
  // ----------------------------------------------------------
  // run - one full round of all jobs
  // ----------------------------------------------------------
  const run = async () => {                                 // the function that runs every minute
    if (running) return;                                    // last run not finished so skip
    running = true;                                         // mark that we are running now
    try {                                                   // job 1 can fail alone
      await expirePastPendingBookings();                    // expire old pending bookings
    } catch (error) {                                       // job 1 failed
      console.error('Pending booking expiration failed:', error);  // show the error
    }                                                       // end of catch

    try {                                                   // job 2 can fail alone
      await processDueReminders();                          // make the due reminders
    } catch (error) {                                       // job 2 failed
      console.error('Booking reminder processing failed:', error);  // show the error
    }                                                       // end of catch

    // clean old notifications only once a day
    if (Date.now() >= nextNotificationCleanup) {            // time for the cleanup
      try {                                                 // job 3 can fail alone
        await deleteExpiredNotifications();                 // delete old notifications
        // set the next cleanup for 24 hours from now
        nextNotificationCleanup = Date.now() + 24 * 60 * 60 * 1000;
      } catch (error) {                                     // job 3 failed
        console.error('Notification retention cleanup failed:', error);  // show the error
      }                                                     // end of catch
    }                                                       // end of if

    running = false;                                        // done, allow the next run
  };                                                        // end of run

  // ----------------------------------------------------------
  // start the timer
  // ----------------------------------------------------------
  void run();                                               // run one time right now
  return setInterval(run, 60 * 1000);                       // then run every 60 seconds
}                                                           // end of function

// ==============================================================
// EXPORT - let other files use these functions
// ==============================================================
module.exports = {                                          // share the functions
  expirePastPendingBookings,                                // expire old pending bookings
  processDueReminders,                                      // make booking reminders
  deleteExpiredNotifications,                               // delete old notifications
  startReminderScheduler,                                   // start the timer
};                                                          // end of exports