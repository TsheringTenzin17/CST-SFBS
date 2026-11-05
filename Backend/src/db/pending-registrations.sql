-- Store signup details until the email verification link is used.
-- Run with: node src/db/run-sql.js src/db/pending-registrations.sql
CREATE TABLE IF NOT EXISTS pending_registrations (
  token_hash CHAR(64) PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  student_staff_id VARCHAR(50),
  role VARCHAR(20) NOT NULL CHECK (role IN ('student','faculty','outsider')),
  password_hash VARCHAR(255) NOT NULL,
  contact_number VARCHAR(30) NOT NULL,
  organization VARCHAR(120),
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('female','male')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires
  ON pending_registrations(expires_at);