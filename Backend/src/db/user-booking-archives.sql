-- Run once on existing databases:
-- node src/db/run-sql.js src/db/user-booking-archives.sql
CREATE TABLE IF NOT EXISTS user_booking_archives (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, booking_id)
);
