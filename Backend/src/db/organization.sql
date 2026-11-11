-- ORGANIZATION
-- adds the organization or team name that outsiders give when they register
-- run with: node src/db/run-sql.js src/db/organization.sql

-- ADD ORGANIZATION COLUMN TO USERS
ALTER TABLE users                                                       -- change the users table
ADD COLUMN IF NOT EXISTS organization VARCHAR(120);                     -- organization or team name, max 120 letters, ; ends this command
