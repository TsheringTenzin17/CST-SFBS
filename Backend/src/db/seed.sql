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

-- 2. Football Ground — daily 6-8am free student slot (all 7 days)
INSERT INTO schedule_rules (facility_id, day_of_week, start_time, end_time, primary_role, fallback_role, fallback_type, notes)
SELECT f.id, d, '06:00'::time, '08:00'::time, 'student', NULL, 'none', 'Daily free student slot (football only)'
FROM facilities f, generate_series(0,6) AS d
WHERE f.name = 'Football Ground';

-- 3. Football Ground — weekday schedule
INSERT INTO schedule_rules (facility_id, day_of_week, start_time, end_time, primary_role, fallback_role, fallback_type, notes)
SELECT id, 1, '16:00'::time, '22:00'::time, 'maintenance', NULL, 'none', 'Monday: maintenance / college team practice, all evening' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 2, '16:00'::time, '18:00'::time, 'student', NULL, 'none', 'Tuesday' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 2, '18:00'::time, '20:00'::time, 'commercial', NULL, 'none', 'Tuesday' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 2, '20:00'::time, '22:00'::time, 'any', NULL, 'none', 'Tuesday: student or commercial, first to book' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 3, '16:00'::time, '18:00'::time, 'student', NULL, 'none', 'Wednesday' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 3, '18:00'::time, '20:00'::time, 'faculty_female', 'commercial', 'auto_release', 'Wednesday: Female Faculty first claim, admin releases to Commercial if unused' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 3, '20:00'::time, '22:00'::time, 'any', NULL, 'none', 'Wednesday: student or commercial, first to book' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 4, '16:00'::time, '18:00'::time, 'student', NULL, 'none', 'Thursday' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 4, '18:00'::time, '20:00'::time, 'faculty_male', NULL, 'none', 'Thursday' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 4, '20:00'::time, '22:00'::time, 'any', NULL, 'none', 'Thursday: student or commercial, first to book' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 5, '16:00'::time, '18:00'::time, 'student', NULL, 'none', 'Friday' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 5, '18:00'::time, '20:00'::time, 'commercial', NULL, 'none', 'Friday' FROM facilities WHERE name = 'Football Ground'
UNION ALL
SELECT id, 5, '20:00'::time, '22:00'::time, 'any', NULL, 'none', 'Friday: student or commercial, first to book' FROM facilities WHERE name = 'Football Ground';

-- 4. Football Ground — weekend schedule (0=Sun, 6=Sat)
INSERT INTO schedule_rules (facility_id, day_of_week, start_time, end_time, primary_role, fallback_role, fallback_type, notes)
SELECT id, d, '08:00'::time, '16:00'::time, 'student', NULL, 'none', 'Weekend: 3 matches reserved for students before 4pm'
FROM facilities, generate_series(0,6,6) AS d
WHERE name = 'Football Ground'
UNION ALL
SELECT id, d, '16:00'::time, '22:00'::time, 'commercial', NULL, 'none', 'Weekend: commercial use 4-10pm'
FROM facilities, generate_series(0,6,6) AS d
WHERE name = 'Football Ground';

-- 5. Basketball, Volleyball, Badminton, Table Tennis — same rule every day:
--    4-10pm only, both students (free) and outsiders (commercial rate) eligible,
--    1 hour max enforced via facilities.max_duration_minutes.
INSERT INTO schedule_rules (facility_id, day_of_week, start_time, end_time, primary_role, fallback_role, fallback_type, notes)
SELECT f.id, d, '16:00'::time, '22:00'::time, 'any', NULL, 'none', 'Free for students, commercial rate for outsiders. 1hr max per booking.'
FROM facilities f, generate_series(0,6) AS d
WHERE f.group_name IN ('Basketball Court','Volleyball Court','Badminton Court','Table Tennis Hall');

-- 6. Archery Range — intentionally left with no schedule_rules.
-- DSA left this open; the team defines the structure (see spec Section 4)
-- and should insert rules here once decided.