-- Lets admins describe a facility and give it a photo (used for sports added from the admin page).
-- Run with: node src/db/run-sql.js src/db/facility-management.sql
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS image_url VARCHAR(300);
