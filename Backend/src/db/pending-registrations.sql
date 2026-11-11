-- PENDING REGISTRATIONS
-- stores signup details until the email verification link is used
-- run with: node src/db/run-sql.js src/db/pending-registrations.sql

-- CREATE THE PENDING REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS pending_registrations (                      -- make the table only if it does not exist
  token_hash CHAR(64) PRIMARY KEY,                                      -- hashed verification token, 64 characters, main key
  cancel_token_hash CHAR(64) UNIQUE,                                    -- hashed cancel token, 64 characters, no repeats
  full_name VARCHAR(120) NOT NULL,                                      -- full name of the person, must be given
  email VARCHAR(150) UNIQUE NOT NULL,                                   -- email address, no repeats, must be given
  student_staff_id VARCHAR(50),                                         -- student or staff id, can be empty
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'faculty', 'outsider')),   -- role must be student, faculty or outsider
  password_hash VARCHAR(255) NOT NULL,                                  -- hashed password, must be given
  contact_number VARCHAR(30) NOT NULL,                                  -- phone number, must be given
  organization VARCHAR(120),                                            -- organization or team name, can be empty
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('female', 'male')),     -- gender must be female or male
  expires_at TIMESTAMPTZ NOT NULL,                                      -- when this signup link stops working
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()                         -- when this record was created, default is now
);                                                                      -- end of the table, ; ends this command

-- ADD CANCEL TOKEN COLUMN, for tables that were made before this column existed
ALTER TABLE pending_registrations                                       -- change the pending_registrations table
ADD COLUMN IF NOT EXISTS cancel_token_hash CHAR(64);                    -- hashed cancel token, ; ends this command

-- INDEX TO FIND EXPIRED SIGNUPS FAST
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires ON pending_registrations (expires_at);   -- index on expires_at, makes searching by expiry faster

-- UNIQUE INDEX FOR CANCEL TOKEN
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_registrations_cancel_token ON pending_registrations (cancel_token_hash)   -- no two rows can have the same cancel token
WHERE                                                                   -- only apply the index to rows that match below
  cancel_token_hash IS NOT NULL;                                        -- rows that have a cancel token, ; ends this command
