-- FACILITY IMAGE STORAGE, safe to run more than once
-- lets a facility photo be uploaded as a compressed data URL, not only a web link
-- run with: node src/db/run-sql.js src/db/facility-image-storage.sql

-- CHANGE IMAGE COLUMN TYPE
ALTER TABLE facilities                     -- change the facilities table
ALTER COLUMN image_url TYPE TEXT;          -- image_url can now hold long text, ; ends this command