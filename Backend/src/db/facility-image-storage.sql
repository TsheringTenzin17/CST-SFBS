-- Lets a facility photo be uploaded (stored as a compressed data URL) instead of only a web link.
-- Safe to run more than once.
-- Run with: node src/db/run-sql.js src/db/facility-image-storage.sql
ALTER TABLE facilities ALTER COLUMN image_url TYPE TEXT;
