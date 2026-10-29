-- =============================================================
-- Backend/src/db/football-timetable.sql   (safe to re-run)
-- =============================================================
-- Moves the Football Ground to the DSA timetable (Timings.docx):
--   * two timetables: 'standard' (no tournament) and 'tournament'
--   * Monday maintenance all day
--   * weekend student matches capped per day
-- Run with: node src/db/run-sql.js src/db/football-timetable.sql
-- Then run football-timetable-check.sql to find bookings the new rules orphan.
--
-- schedule_rules.timetable:  'all' (every day) | 'standard' | 'tournament'
-- schedule_rules.day_booking_cap: max non-cancelled bookings per facility per
--   day across ALL capped rules of that day (NULL = no cap)

-- 1. New columns -------------------------------------------------------
ALTER TABLE schedule_rules ADD COLUMN IF NOT EXISTS timetable VARCHAR(20) NOT NULL DEFAULT 'all';
ALTER TABLE schedule_rules DROP CONSTRAINT IF EXISTS schedule_rules_timetable_check;
ALTER TABLE schedule_rules ADD CONSTRAINT schedule_rules_timetable_check
  CHECK (timetable IN ('all', 'standard', 'tournament'));

ALTER TABLE schedule_rules ADD COLUMN IF NOT EXISTS day_booking_cap SMALLINT;
ALTER TABLE schedule_rules DROP CONSTRAINT IF EXISTS schedule_rules_day_booking_cap_check;
ALTER TABLE schedule_rules ADD CONSTRAINT schedule_rules_day_booking_cap_check
  CHECK (day_booking_cap IS NULL OR day_booking_cap > 0);

-- 2. Tournament periods (admin-managed date ranges) --------------------
CREATE TABLE IF NOT EXISTS tournament_periods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- 3. Unique rule index must now include the timetable ------------------
DROP INDEX IF EXISTS unique_schedule_rule;
CREATE UNIQUE INDEX IF NOT EXISTS unique_schedule_rule
  ON schedule_rules (
    facility_id, day_of_week, start_time, end_time, primary_role,
    (COALESCE(fallback_role, '')), (COALESCE(fallback_type, '')), timetable
  );

-- 4. Replace ONLY the football rules (other facilities are untouched) ---
DELETE FROM schedule_rules
WHERE facility_id = (SELECT id FROM facilities WHERE name = 'Football Ground');

INSERT INTO schedule_rules
  (facility_id, day_of_week, start_time, end_time, primary_role, fallback_role, fallback_type, timetable, day_booking_cap, notes)
SELECT f.id, r.dow, r.s::time, r.e::time, r.role, r.fb_role, r.fb_type, r.tt, r.cap::smallint, r.note
FROM facilities f
CROSS JOIN (VALUES
  -- Monday (1): ground maintenance all day
  (1, '06:00', '22:00', 'maintenance',    NULL,         'none',         'all',        NULL, 'Monday: ground maintenance'),
  -- Tuesday (2)
  (2, '06:00', '08:00', 'student',        NULL,         'none',         'all',        NULL, 'Tuesday: students'),
  (2, '16:00', '18:00', 'student',        NULL,         'none',         'all',        NULL, 'Tuesday: students'),
  (2, '18:00', '20:00', 'commercial',     NULL,         'none',         'all',        NULL, 'Tuesday: hiring'),
  (2, '20:00', '22:00', 'student',        NULL,         'none',         'tournament', NULL, 'Tuesday 8-10 PM: students (department tournament)'),
  (2, '20:00', '22:00', 'commercial',     NULL,         'none',         'standard',   NULL, 'Tuesday 8-10 PM: hiring'),
  -- Wednesday (3)
  (3, '06:00', '08:00', 'student',        NULL,         'none',         'all',        NULL, 'Wednesday: students'),
  (3, '16:00', '18:00', 'student',        NULL,         'none',         'tournament', NULL, 'Wednesday 4-6 PM: students (department tournament)'),
  (3, '16:00', '18:00', 'student_female', NULL,         'none',         'standard',   NULL, 'Wednesday 4-6 PM: reserved for female students'),
  (3, '18:00', '20:00', 'student_female', 'commercial', 'auto_release', 'tournament', NULL, 'Wednesday 6-8 PM: female students first; opens to hiring 1 hour before'),
  (3, '18:00', '20:00', 'commercial',     NULL,         'none',         'standard',   NULL, 'Wednesday 6-8 PM: hiring'),
  (3, '20:00', '22:00', 'student',        NULL,         'none',         'tournament', NULL, 'Wednesday 8-10 PM: students (department tournament)'),
  (3, '20:00', '22:00', 'commercial',     NULL,         'none',         'standard',   NULL, 'Wednesday 8-10 PM: hiring'),
  -- Thursday (4)
  (4, '06:00', '08:00', 'student',        NULL,         'none',         'all',        NULL, 'Thursday: students'),
  (4, '16:00', '18:00', 'student',        NULL,         'none',         'all',        NULL, 'Thursday: students'),
  (4, '18:00', '20:00', 'faculty',        NULL,         'none',         'all',        NULL, 'Thursday 6-8 PM: reserved for staff'),
  (4, '20:00', '22:00', 'student',        NULL,         'none',         'tournament', NULL, 'Thursday 8-10 PM: students (department tournament)'),
  (4, '20:00', '22:00', 'commercial',     NULL,         'none',         'standard',   NULL, 'Thursday 8-10 PM: hiring'),
  -- Friday (5)
  (5, '06:00', '08:00', 'student',        NULL,         'none',         'all',        NULL, 'Friday: students'),
  (5, '16:00', '18:00', 'student',        NULL,         'none',         'all',        NULL, 'Friday: students'),
  (5, '18:00', '20:00', 'commercial',     NULL,         'none',         'all',        NULL, 'Friday: hiring'),
  (5, '20:00', '22:00', 'student',        NULL,         'none',         'tournament', NULL, 'Friday 8-10 PM: students (department tournament)'),
  (5, '20:00', '22:00', 'commercial',     NULL,         'none',         'standard',   NULL, 'Friday 8-10 PM: hiring'),
  -- Saturday (6): max 3 student matches, then hiring 4-10 PM
  (6, '06:00', '12:00', 'student',        NULL,         'none',         'all',        3,    'Saturday: max 3 student matches (6-8, 8-10, 10-12)'),
  (6, '16:00', '22:00', 'commercial',     NULL,         'none',         'all',        NULL, 'Saturday: hiring 4-10 PM'),
  -- Sunday (0): 4 slots listed but only 3 bookings, then the day closes for students
  (0, '06:00', '12:00', 'student',        NULL,         'none',         'all',        3,    'Sunday: max 3 student bookings per day (6-8, 8-10, 10-12, 2-4)'),
  (0, '14:00', '16:00', 'student',        NULL,         'none',         'all',        3,    'Sunday: max 3 student bookings per day (6-8, 8-10, 10-12, 2-4)'),
  (0, '16:00', '22:00', 'commercial',     NULL,         'none',         'all',        NULL, 'Sunday: hiring 4-10 PM')
) AS r(dow, s, e, role, fb_role, fb_type, tt, cap, note)
WHERE f.name = 'Football Ground'
ON CONFLICT DO NOTHING;
