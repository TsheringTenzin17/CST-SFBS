-- FACILITY MANAGEMENT
-- lets admins describe a facility and give it a photo, used for sports added from the admin page
-- run with: node src/db/run-sql.js src/db/facility-management.sql

-- ADD DESCRIPTION COLUMN
ALTER TABLE facilities                                                  -- change the facilities table
ADD COLUMN IF NOT EXISTS description TEXT;                              -- text about the facility, ; ends this command

-- ADD IMAGE COLUMN
ALTER TABLE facilities                                                  -- change the facilities table again
ADD COLUMN IF NOT EXISTS image_url VARCHAR(300);                       -- link to the facility photo, max 300 letters, ; ends this command
