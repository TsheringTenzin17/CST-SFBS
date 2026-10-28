-- Adds the organization / team name that outsiders give when they register.
-- Run with: node src/db/run-sql.js src/db/organization.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(120);
