-- Adds email verification/reset tokens and deduplicated booking reminders.
-- Existing accounts remain verified; new public registrations explicitly start unverified.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose
  ON auth_tokens(user_id, purpose, expires_at);

CREATE TABLE IF NOT EXISTS booking_reminders (
  id BIGSERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  lead_hours SMALLINT NOT NULL CHECK (lead_hours IN (2, 24)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, scheduled_for, lead_hours)
);

CREATE INDEX IF NOT EXISTS idx_booking_reminders_created_at
  ON booking_reminders(created_at);
