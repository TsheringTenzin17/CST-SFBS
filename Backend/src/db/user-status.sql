-- USER STATUS
-- this lets admins suspend or reactivate a user account
-- it is used in Registered Users -> Edit / Suspend
-- it is safe to run more than once
-- how to run: node src/db/run-sql.js src/db/user-status.sql

-- change the existing users table
ALTER TABLE users

-- add the is_active column only if it does not exist already
-- TRUE means the account is active, FALSE means it is suspended
-- it must always have a value, and by default it is TRUE
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;