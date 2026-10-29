-- Lets outsider accounts change their email address after confirming the new one.
-- Safe to run more than once.
-- Run with: node src/db/run-sql.js src/db/email-change.sql
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS new_email VARCHAR(150);

ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_purpose_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_purpose_check
  CHECK (purpose IN ('email_verification', 'password_reset', 'email_change'));
