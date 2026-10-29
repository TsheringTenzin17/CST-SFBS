-- CST-SFBS seed data
-- Encodes the DSA-confirmed rules from CST-SFBS_Booking_Rules_Spec.md.
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

-- 1. Facilities
INSERT INTO facilities (name, type, group_name, court_label, capacity, location, max_duration_minutes, is_active) VALUES
  ('Football Ground', 'football', 'Football Ground', NULL, 30, 'Main Campus', NULL, true),
  ('Basketball Court', 'basketball', 'Basketball Court', NULL, 20, 'Main Campus', 60, true),
  ('Volleyball Court (Male)', 'volleyball', 'Volleyball Court', 'Male', 20, 'Main Campus', 60, true),
  ('Volleyball Court (Female)', 'volleyball', 'Volleyball Court', 'Female', 20, 'Main Campus', 60, true),
  ('Badminton Court 1', 'badminton', 'Badminton Court', '1', 16, 'Main Campus', 60, true),
  ('Badminton Court 2', 'badminton', 'Badminton Court', '2', 16, 'Main Campus', 60, true),
  ('Table Tennis Table 1', 'table_tennis', 'Table Tennis Hall', '1', 8, 'Main Campus', 60, true),
  ('Table Tennis Table 2', 'table_tennis', 'Table Tennis Hall', '2', 8, 'Main Campus', 60, true),
  ('Archery Range', 'archery', 'Archery Range', NULL, 10, 'Main Campus', NULL, true)
ON CONFLICT (name) DO NOTHING;

-- 2. Football Ground — DSA timetable (see Timings.docx)
--    timetable: 'all' = every day; 'standard' = no tournament; 'tournament' = department tournament period.
--    day_booking_cap = max bookings per day across all capped rules (weekend student matches).
--    NOTE: 'student_female' needs a gender field on users before anyone can book it.
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

-- 5. Basketball, Volleyball, Badminton, Table Tennis — weekdays 4-10pm;
--    weekends 8am-10pm for students, faculty/staff, and outsiders.
DELETE FROM schedule_rules
WHERE facility_id IN (
  SELECT id FROM facilities
  WHERE group_name IN ('Basketball Court','Volleyball Court','Badminton Court','Table Tennis Hall')
)
AND day_of_week IN (0, 6);

INSERT INTO schedule_rules (facility_id, day_of_week, start_time, end_time, primary_role, fallback_role, fallback_type, notes)
SELECT f.id, d, '08:00'::time, '22:00'::time, 'everyone', NULL, 'none', 'Weekend open to students, faculty/staff, and outsiders; 1hr max per booking.'
FROM facilities f, generate_series(0,6,6) AS d
WHERE f.group_name IN ('Basketball Court','Volleyball Court','Badminton Court','Table Tennis Hall')
ON CONFLICT DO NOTHING;

-- 6. Archery Range — every role can book 4-10pm on weekdays and 8am-10pm on weekends.
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