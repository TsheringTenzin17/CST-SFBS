-- =============================================================
-- Backend/src/db/booking-hardening.sql   (safe to re-run on the shared database)
-- Run this before seed.sql so schedule-rule inserts are idempotent.
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

-- 4. Remove repeated schedule entries and prevent the seed script from
--    adding them again. Keep the oldest row for each equivalent rule.
WITH ranked_rules AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY facility_id, day_of_week, start_time, end_time, primary_role,
                        COALESCE(fallback_role, ''), COALESCE(fallback_type, '')
           ORDER BY id
         ) AS duplicate_number
  FROM schedule_rules
)
DELETE FROM schedule_rules
WHERE id IN (SELECT id FROM ranked_rules WHERE duplicate_number > 1);

CREATE UNIQUE INDEX IF NOT EXISTS unique_schedule_rule
  ON schedule_rules (
    facility_id, day_of_week, start_time, end_time, primary_role,
    (COALESCE(fallback_role, '')), (COALESCE(fallback_type, ''))
  );

-- 5. Archery is open to every role 4-10pm on weekdays and 8am-10pm on weekends.
DELETE FROM schedule_rules
WHERE facility_id = (SELECT id FROM facilities WHERE name = 'Archery Range');

INSERT INTO schedule_rules (facility_id, day_of_week, start_time, end_time, primary_role, fallback_type, notes)
SELECT f.id, d.day_of_week,
       CASE WHEN d.day_of_week IN (0, 6) THEN '08:00'::time ELSE '16:00'::time END,
       '22:00'::time, 'everyone', 'none', 'Open to students, faculty/staff, and outsiders'
FROM facilities f
CROSS JOIN generate_series(0, 6) AS d(day_of_week)
WHERE f.name = 'Archery Range'
ON CONFLICT DO NOTHING;

-- 6. Other sports: open weekends 8am-10pm to every role; preserve weekday rules.
DELETE FROM schedule_rules
WHERE facility_id IN (
  SELECT id FROM facilities
  WHERE group_name IN ('Basketball Court','Volleyball Court','Badminton Court','Table Tennis Hall')
)
AND day_of_week IN (0, 6);

INSERT INTO schedule_rules (facility_id, day_of_week, start_time, end_time, primary_role, fallback_role, fallback_type, notes)
SELECT f.id, d, '08:00'::time, '22:00'::time, 'everyone', NULL, 'none', 'Weekend open to students, faculty/staff, and outsiders; 1hr max per booking.'
FROM facilities f, generate_series(0, 6, 6) AS d
WHERE f.group_name IN ('Basketball Court','Volleyball Court','Badminton Court','Table Tennis Hall')
ON CONFLICT DO NOTHING;