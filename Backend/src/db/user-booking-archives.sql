-- How to run: run this file once on an existing database
-- Command: node src/db/run-sql.js src/db/user-booking-archives.sql

-- create the table only if it does not exist already
CREATE TABLE IF NOT EXISTS user_booking_archives (

  -- id of the user who archived the booking
  -- if the user is deleted, this row is deleted too
  user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- id of the booking that was archived
  -- if the booking is deleted, this row is deleted too
  booking_id INT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,

  -- date and time when the user archived the booking
  -- it is set to the current time automatically
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- one user can archive one booking only once
  -- so the pair (user_id, booking_id) must be unique
  PRIMARY KEY (user_id, booking_id)
);