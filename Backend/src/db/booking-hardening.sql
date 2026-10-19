-- =============================================================
-- Backend/src/db/booking-hardening.sql   (run ONCE on the shared database)
-- =============================================================
-- 1. A cancelled booking must free its slot, so the "one booking per slot"
--    rule now ignores cancelled rows.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS unique_facility_slot;
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_slot
  ON bookings (facility_id, booking_date, start_time)
  WHERE status <> 'cancelled';

-- 2. Maintenance blocks (used by the booking API and the admin dashboard).
CREATE TABLE IF NOT EXISTS maintenance_blocks (
  id SERIAL PRIMARY KEY,
  facility_id INT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- 3. The Wednesday faculty slot now opens by itself (no admin click).
UPDATE schedule_rules SET fallback_type = 'auto_release'
WHERE fallback_type = 'manual_release';