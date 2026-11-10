-- Store payment proof for paid bookings and record when an admin verifies it.
-- Safe to run more than once.
-- Run with: node src/db/run-sql.js src/db/booking-payment-proof.sql
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_amount INTEGER,
ADD COLUMN IF NOT EXISTS payment_journal_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_screenshot TEXT,
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_resolution VARCHAR(10),
ADD COLUMN IF NOT EXISTS payment_resolution_completed_at TIMESTAMPTZ;

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_payment_amount_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_payment_amount_check CHECK (
  payment_amount IS NULL
  OR payment_amount > 0
);

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_payment_resolution_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_payment_resolution_check CHECK (
  payment_resolution IN ('refund', 'credit')
  OR payment_resolution IS NULL
);
