-- Lets admins suspend / reactivate an account (Registered Users -> Edit / Suspend).
-- Safe to run more than once.
-- Run with: node src/db/run-sql.js src/db/user-status.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
