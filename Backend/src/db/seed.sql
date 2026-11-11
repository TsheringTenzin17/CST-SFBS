-- CST-SFBS SEED DATA
-- encodes the DSA-confirmed rules from CST-SFBS_Booking_Rules_Spec.md
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

-- 1. FACILITIES
INSERT INTO                                                              -- add new rows into the table
  facilities (                                                           -- the facilities table, columns listed below
    name,                                                                -- facility name
    type,                                                                -- kind of facility
    group_name,                                                          -- group the facility belongs to
    court_label,                                                         -- court name or number
    capacity,                                                            -- how many people can use it
    location,                                                            -- where the facility is
    max_duration_minutes,                                                -- longest booking time in minutes
    is_active                                                            -- is the facility in use
  )                                                                      -- end of the column list
VALUES                                                                   -- start of the rows to add
  (                                                                      -- start of one facility
    'Football Ground',                                                   -- name
    'football',                                                          -- type
    'Football Ground',                                                   -- group
    NULL,                                                                -- no court label
    30,                                                                  -- capacity is 30
    'Main Campus',                                                       -- location
    NULL,                                                                -- no max duration
    TRUE                                                                 -- facility is active
  ),                                                                     -- end of this facility
  (                                                                      -- start of one facility
    'Basketball Court',                                                  -- name
    'basketball',                                                        -- type
    'Basketball Court',                                                  -- group
    NULL,                                                                -- no court label
    20,                                                                  -- capacity is 20
    'Main Campus',                                                       -- location
    60,                                                                  -- max 60 minutes
    TRUE                                                                 -- facility is active
  ),                                                                     -- end of this facility
  (                                                                      -- start of one facility
    'Volleyball Court (Male)',                                           -- name
    'volleyball',                                                        -- type
    'Volleyball Court',                                                  -- group
    'Male',                                                              -- court label is Male
    20,                                                                  -- capacity is 20
    'Main Campus',                                                       -- location
    60,                                                                  -- max 60 minutes
    TRUE                                                                 -- facility is active
  ),                                                                     -- end of this facility
  (                                                                      -- start of one facility
    'Volleyball Court (Female)',                                         -- name
    'volleyball',                                                        -- type
    'Volleyball Court',                                                  -- group
    'Female',                                                            -- court label is Female
    20,                                                                  -- capacity is 20
    'Main Campus',                                                       -- location
    60,                                                                  -- max 60 minutes
    TRUE                                                                 -- facility is active
  ),                                                                     -- end of this facility
  (                                                                      -- start of one facility
    'Badminton Court 1',                                                 -- name
    'badminton',                                                         -- type
    'Badminton Court',                                                   -- group
    '1',                                                                 -- court label is 1
    16,                                                                  -- capacity is 16
    'Main Campus',                                                       -- location
    60,                                                                  -- max 60 minutes
    TRUE                                                                 -- facility is active
  ),                                                                     -- end of this facility
  (                                                                      -- start of one facility
    'Badminton Court 2',                                                 -- name
    'badminton',                                                         -- type
    'Badminton Court',                                                   -- group
    '2',                                                                 -- court label is 2
    16,                                                                  -- capacity is 16
    'Main Campus',                                                       -- location
    60,                                                                  -- max 60 minutes
    TRUE                                                                 -- facility is active
  ),                                                                     -- end of this facility
  (                                                                      -- start of one facility
    'Table Tennis Table 1',                                              -- name
    'table_tennis',                                                      -- type
    'Table Tennis Hall',                                                 -- group
    '1',                                                                 -- table label is 1
    8,                                                                   -- capacity is 8
    'Main Campus',                                                       -- location
    60,                                                                  -- max 60 minutes
    TRUE                                                                 -- facility is active
  ),                                                                     -- end of this facility
  (                                                                      -- start of one facility
    'Table Tennis Table 2',                                              -- name
    'table_tennis',                                                      -- type
    'Table Tennis Hall',                                                 -- group
    '2',                                                                 -- table label is 2
    8,                                                                   -- capacity is 8
    'Main Campus',                                                       -- location
    60,                                                                  -- max 60 minutes
    TRUE                                                                 -- facility is active
  ),                                                                     -- end of this facility
  (                                                                      -- start of one facility
    'Archery Range',                                                     -- name
    'archery',                                                           -- type
    'Archery Range',                                                     -- group
    NULL,                                                                -- no court label
    10,                                                                  -- capacity is 10
    'Main Campus',                                                       -- location
    NULL,                                                                -- no max duration
    TRUE                                                                 -- facility is active
  )                                                                      -- end of the last facility, no comma after it
ON CONFLICT (name) DO NOTHING;                                           -- skip a facility if the name already exists, ; ends this command

-- 2. FOOTBALL GROUND, DSA timetable (see Timings.docx)
-- timetable: all = every day, standard = no tournament, tournament = department tournament period
-- day_booking_cap = max bookings per day across all capped rules (weekend student matches)
-- NOTE: student_female needs a gender field on users before anyone can book it
INSERT INTO                                                              -- add new rows into the table
  schedule_rules (                                                       -- the schedule_rules table, columns listed below
    facility_id,                                                         -- which facility
    day_of_week,                                                         -- which day
    start_time,                                                          -- slot start time
    end_time,                                                            -- slot end time
    primary_role,                                                        -- role that can book first
    fallback_role,                                                       -- role that can book later
    fallback_type,                                                       -- how the slot is released to the fallback role
    timetable,                                                           -- which timetable the rule is for
    day_booking_cap,                                                     -- max bookings in one day
    notes                                                                -- note to explain the rule
  )                                                                      -- end of the column list
SELECT                                                                   -- get the values for the new rows
  f.id,                                                                  -- facility id from the facilities table
  r.dow,                                                                 -- day of week from the list below
  r.s::time,                                                             -- start text changed to time
  r.e::time,                                                             -- end text changed to time
  r.role,                                                                -- first role from the list below
  r.fb_role,                                                             -- fallback role from the list below
  r.fb_type,                                                             -- fallback type from the list below
  r.tt,                                                                  -- timetable from the list below
  r.cap::smallint,                                                       -- cap changed to small number
  r.note                                                                 -- note from the list below
FROM                                                                     -- say where the data comes from
  facilities f                                                           -- the facilities table, called f
  CROSS JOIN (                                                           -- join every facility with every row of the list below
    VALUES                                                               -- start of the list of rules
       -- Monday (1): ground maintenance all day
      (                                                                  -- start of one rule
        1,                                                               -- day is Monday
        '06:00',                                                         -- starts at 6 AM
        '22:00',                                                         -- ends at 10 PM
        'maintenance',                                                   -- role is maintenance
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Monday: ground maintenance'                                     -- note
      ),                                                                 -- end of this rule
       -- Tuesday (2)
      (                                                                  -- start of one rule
        2,                                                               -- day is Tuesday
        '06:00',                                                         -- starts at 6 AM
        '08:00',                                                         -- ends at 8 AM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Tuesday: students'                                              -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        2,                                                               -- day is Tuesday
        '16:00',                                                         -- starts at 4 PM
        '18:00',                                                         -- ends at 6 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Tuesday: students'                                              -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        2,                                                               -- day is Tuesday
        '18:00',                                                         -- starts at 6 PM
        '20:00',                                                         -- ends at 8 PM
        'commercial',                                                    -- role is commercial
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Tuesday: hiring'                                                -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        2,                                                               -- day is Tuesday
        '20:00',                                                         -- starts at 8 PM
        '22:00',                                                         -- ends at 10 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'tournament',                                                    -- only in tournament timetable
        NULL,                                                            -- no cap
        'Tuesday 8-10 PM: students (department tournament)'              -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        2,                                                               -- day is Tuesday
        '20:00',                                                         -- starts at 8 PM
        '22:00',                                                         -- ends at 10 PM
        'commercial',                                                    -- role is commercial
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'standard',                                                      -- only in standard timetable
        NULL,                                                            -- no cap
        'Tuesday 8-10 PM: hiring'                                        -- note
      ),                                                                 -- end of this rule
       -- Wednesday (3)
      (                                                                  -- start of one rule
        3,                                                               -- day is Wednesday
        '06:00',                                                         -- starts at 6 AM
        '08:00',                                                         -- ends at 8 AM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Wednesday: students'                                            -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        3,                                                               -- day is Wednesday
        '16:00',                                                         -- starts at 4 PM
        '18:00',                                                         -- ends at 6 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'tournament',                                                    -- only in tournament timetable
        NULL,                                                            -- no cap
        'Wednesday 4-6 PM: students (department tournament)'             -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        3,                                                               -- day is Wednesday
        '16:00',                                                         -- starts at 4 PM
        '18:00',                                                         -- ends at 6 PM
        'student_female',                                                -- female students book first
        'commercial',                                                    -- then commercial can book
        'day_start_release',                                             -- slot is released at the start of the day
        'standard',                                                      -- only in standard timetable
        NULL,                                                            -- no cap
        'Wednesday 4-6 PM: female students first (book before Wed 12:00 AM); opens to hiring 12:05 AM'    -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        3,                                                               -- day is Wednesday
        '18:00',                                                         -- starts at 6 PM
        '20:00',                                                         -- ends at 8 PM
        'student_female',                                                -- female students book first
        'commercial',                                                    -- then commercial can book
        'day_start_release',                                             -- slot is released at the start of the day
        'tournament',                                                    -- only in tournament timetable
        NULL,                                                            -- no cap
        'Wednesday 6-8 PM: female students first (book before Wed 12:00 AM); opens to hiring 12:05 AM'    -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        3,                                                               -- day is Wednesday
        '18:00',                                                         -- starts at 6 PM
        '20:00',                                                         -- ends at 8 PM
        'commercial',                                                    -- role is commercial
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'standard',                                                      -- only in standard timetable
        NULL,                                                            -- no cap
        'Wednesday 6-8 PM: hiring'                                       -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        3,                                                               -- day is Wednesday
        '20:00',                                                         -- starts at 8 PM
        '22:00',                                                         -- ends at 10 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'tournament',                                                    -- only in tournament timetable
        NULL,                                                            -- no cap
        'Wednesday 8-10 PM: students (department tournament)'            -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        3,                                                               -- day is Wednesday
        '20:00',                                                         -- starts at 8 PM
        '22:00',                                                         -- ends at 10 PM
        'commercial',                                                    -- role is commercial
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'standard',                                                      -- only in standard timetable
        NULL,                                                            -- no cap
        'Wednesday 8-10 PM: hiring'                                      -- note
      ),                                                                 -- end of this rule
       -- Thursday (4)
      (                                                                  -- start of one rule
        4,                                                               -- day is Thursday
        '06:00',                                                         -- starts at 6 AM
        '08:00',                                                         -- ends at 8 AM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Thursday: students'                                             -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        4,                                                               -- day is Thursday
        '16:00',                                                         -- starts at 4 PM
        '18:00',                                                         -- ends at 6 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Thursday: students'                                             -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        4,                                                               -- day is Thursday
        '18:00',                                                         -- starts at 6 PM
        '20:00',                                                         -- ends at 8 PM
        'faculty',                                                       -- faculty can book first
        'commercial',                                                    -- then commercial can book
        'weekly_release',                                                -- slot is released weekly
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Thursday 6-8 PM: free for faculty until Wednesday 8 PM, then commercial'    -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        4,                                                               -- day is Thursday
        '20:00',                                                         -- starts at 8 PM
        '22:00',                                                         -- ends at 10 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'tournament',                                                    -- only in tournament timetable
        NULL,                                                            -- no cap
        'Thursday 8-10 PM: students (department tournament)'             -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        4,                                                               -- day is Thursday
        '20:00',                                                         -- starts at 8 PM
        '22:00',                                                         -- ends at 10 PM
        'commercial',                                                    -- role is commercial
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'standard',                                                      -- only in standard timetable
        NULL,                                                            -- no cap
        'Thursday 8-10 PM: hiring'                                       -- note
      ),                                                                 -- end of this rule
       -- Friday (5)
      (                                                                  -- start of one rule
        5,                                                               -- day is Friday
        '06:00',                                                         -- starts at 6 AM
        '08:00',                                                         -- ends at 8 AM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Friday: students'                                               -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        5,                                                               -- day is Friday
        '16:00',                                                         -- starts at 4 PM
        '18:00',                                                         -- ends at 6 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Friday: students'                                               -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        5,                                                               -- day is Friday
        '18:00',                                                         -- starts at 6 PM
        '20:00',                                                         -- ends at 8 PM
        'commercial',                                                    -- role is commercial
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Friday: hiring'                                                 -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        5,                                                               -- day is Friday
        '20:00',                                                         -- starts at 8 PM
        '22:00',                                                         -- ends at 10 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'tournament',                                                    -- only in tournament timetable
        NULL,                                                            -- no cap
        'Friday 8-10 PM: students (department tournament)'               -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        5,                                                               -- day is Friday
        '20:00',                                                         -- starts at 8 PM
        '22:00',                                                         -- ends at 10 PM
        'commercial',                                                    -- role is commercial
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'standard',                                                      -- only in standard timetable
        NULL,                                                            -- no cap
        'Friday 8-10 PM: hiring'                                         -- note
      ),                                                                 -- end of this rule
       -- Saturday (6): max 3 student matches, then hiring 4-10 PM
      (                                                                  -- start of one rule
        6,                                                               -- day is Saturday
        '06:00',                                                         -- starts at 6 AM
        '12:00',                                                         -- ends at 12 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        3,                                                               -- max 3 bookings in this day
        'Saturday: max 3 student matches (6-8, 8-10, 10-12)'             -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        6,                                                               -- day is Saturday
        '16:00',                                                         -- starts at 4 PM
        '22:00',                                                         -- ends at 10 PM
        'commercial',                                                    -- role is commercial
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Saturday: hiring 4-10 PM'                                       -- note
      ),                                                                 -- end of this rule
       -- Sunday (0): 4 slots listed but only 3 bookings, then the day closes for students
      (                                                                  -- start of one rule
        0,                                                               -- day is Sunday
        '06:00',                                                         -- starts at 6 AM
        '12:00',                                                         -- ends at 12 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        3,                                                               -- max 3 bookings in this day
        'Sunday: max 3 student bookings per day (6-8, 8-10, 10-12, 2-4)'    -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        0,                                                               -- day is Sunday
        '14:00',                                                         -- starts at 2 PM
        '16:00',                                                         -- ends at 4 PM
        'student',                                                       -- role is student
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        3,                                                               -- max 3 bookings in this day
        'Sunday: max 3 student bookings per day (6-8, 8-10, 10-12, 2-4)'    -- note
      ),                                                                 -- end of this rule
      (                                                                  -- start of one rule
        0,                                                               -- day is Sunday
        '16:00',                                                         -- starts at 4 PM
        '22:00',                                                         -- ends at 10 PM
        'commercial',                                                    -- role is commercial
        NULL,                                                            -- no fallback role
        'none',                                                          -- no fallback type
        'all',                                                           -- for all timetables
        NULL,                                                            -- no cap
        'Sunday: hiring 4-10 PM'                                         -- note
      )                                                                  -- end of the last rule, no comma after it
  ) AS r (dow, s, e, role, fb_role, fb_type, tt, cap, note)              -- name the list r and name its columns
WHERE                                                                    -- only use the facility that matches below
  f.name = 'Football Ground'                                             -- only the Football Ground facility
ON CONFLICT DO NOTHING;                                                  -- skip any row that already exists, ; ends this command

-- 5. BASKETBALL, VOLLEYBALL, BADMINTON, TABLE TENNIS
-- weekdays 4-10 PM, weekends 8 AM-10 PM, for students, faculty/staff and outsiders

-- DELETE OLD WEEKDAY RULES
DELETE FROM schedule_rules                                               -- delete rows from schedule_rules
WHERE                                                                    -- only rows that match the conditions below
  facility_id IN (                                                       -- facility must be in the list found by this inner query
    SELECT                                                               -- start of the inner query
      id                                                                 -- get the facility ids
    FROM                                                                 -- say which table to look in
      facilities                                                         -- the facilities table
    WHERE                                                                -- filter the facilities
      group_name IN (                                                    -- only these groups
        'Basketball Court',                                              -- basketball group
        'Volleyball Court',                                              -- volleyball group
        'Badminton Court',                                               -- badminton group
        'Table Tennis Hall'                                              -- table tennis group
      )                                                                  -- end of the group list
  )                                                                      -- end of the inner query
  AND day_of_week IN (1, 2, 3, 4, 5);                                    -- only Monday to Friday, ; ends this command

-- ADD NEW WEEKDAY RULES
INSERT INTO                                                              -- add new rows into the table
  schedule_rules (                                                       -- the schedule_rules table, columns listed below
    facility_id,                                                         -- which facility
    day_of_week,                                                         -- which day
    start_time,                                                          -- slot start time
    end_time,                                                            -- slot end time
    primary_role,                                                        -- role that can book
    fallback_role,                                                       -- role that can book later
    fallback_type,                                                       -- how the slot is released
    notes                                                                -- note to explain the rule
  )                                                                      -- end of the column list
SELECT                                                                   -- get the values for the new rows
  f.id,                                                                  -- facility id
  d,                                                                     -- day number from the series below
  '16:00'::time,                                                         -- starts at 4 PM, changed to time
  '22:00'::time,                                                         -- ends at 10 PM, changed to time
  'everyone',                                                            -- every role can book
  NULL,                                                                  -- no fallback role
  'none',                                                                -- no fallback type
  'Weekday open to students, faculty/staff, and outsiders.'              -- note
FROM                                                                     -- say where the data comes from
  facilities f,                                                          -- the facilities table, called f
  generate_series(1, 5) AS d                                             -- make day numbers 1 to 5, called d
WHERE                                                                    -- only use the facilities that match below
  f.group_name IN (                                                      -- only these groups
    'Basketball Court',                                                  -- basketball group
    'Volleyball Court',                                                  -- volleyball group
    'Badminton Court',                                                   -- badminton group
    'Table Tennis Hall'                                                  -- table tennis group
  )                                                                      -- end of the group list
ON CONFLICT DO NOTHING;                                                  -- skip any row that already exists, ; ends this command

-- DELETE OLD WEEKEND RULES
DELETE FROM schedule_rules                                               -- delete rows from schedule_rules
WHERE                                                                    -- only rows that match the conditions below
  facility_id IN (                                                       -- facility must be in the list found by this inner query
    SELECT                                                               -- start of the inner query
      id                                                                 -- get the facility ids
    FROM                                                                 -- say which table to look in
      facilities                                                         -- the facilities table
    WHERE                                                                -- filter the facilities
      group_name IN (                                                    -- only these groups
        'Basketball Court',                                              -- basketball group
        'Volleyball Court',                                              -- volleyball group
        'Badminton Court',                                               -- badminton group
        'Table Tennis Hall'                                              -- table tennis group
      )                                                                  -- end of the group list
  )                                                                      -- end of the inner query
  AND day_of_week IN (0, 6);                                             -- only Sunday and Saturday, ; ends this command

-- ADD NEW WEEKEND RULES
INSERT INTO                                                              -- add new rows into the table
  schedule_rules (                                                       -- the schedule_rules table, columns listed below
    facility_id,                                                         -- which facility
    day_of_week,                                                         -- which day
    start_time,                                                          -- slot start time
    end_time,                                                            -- slot end time
    primary_role,                                                        -- role that can book
    fallback_role,                                                       -- role that can book later
    fallback_type,                                                       -- how the slot is released
    notes                                                                -- note to explain the rule
  )                                                                      -- end of the column list
SELECT                                                                   -- get the values for the new rows
  f.id,                                                                  -- facility id
  d,                                                                     -- day number from the series below
  '08:00'::time,                                                         -- starts at 8 AM, changed to time
  '22:00'::time,                                                         -- ends at 10 PM, changed to time
  'everyone',                                                            -- every role can book
  NULL,                                                                  -- no fallback role
  'none',                                                                -- no fallback type
  'Weekend open to students, faculty/staff, and outsiders; 1hr max per booking.'    -- note
FROM                                                                     -- say where the data comes from
  facilities f,                                                          -- the facilities table, called f
  generate_series(0, 6, 6) AS d                                          -- make day numbers 0 and 6 (step is 6), called d
WHERE                                                                    -- only use the facilities that match below
  f.group_name IN (                                                      -- only these groups
    'Basketball Court',                                                  -- basketball group
    'Volleyball Court',                                                  -- volleyball group
    'Badminton Court',                                                   -- badminton group
    'Table Tennis Hall'                                                  -- table tennis group
  )                                                                      -- end of the group list
ON CONFLICT DO NOTHING;                                                  -- skip any row that already exists, ; ends this command

-- 6. ARCHERY RANGE
-- every role can book 4-10 PM on weekdays and 8 AM-10 PM on weekends

-- DELETE OLD ARCHERY RULES
DELETE FROM schedule_rules                                               -- delete rows from schedule_rules
WHERE                                                                    -- only rows that match the condition below
  facility_id = (                                                        -- facility must be the one found by this inner query
    SELECT                                                               -- start of the inner query
      id                                                                 -- get the id of the facility
    FROM                                                                 -- say which table to look in
      facilities                                                         -- the facilities table
    WHERE                                                                -- filter the facilities
      name = 'Archery Range'                                             -- only the Archery Range
  );                                                                     -- end of the inner query, ; ends this command

-- ADD NEW ARCHERY RULES
INSERT INTO                                                              -- add new rows into the table
  schedule_rules (                                                       -- the schedule_rules table, columns listed below
    facility_id,                                                         -- which facility
    day_of_week,                                                         -- which day
    start_time,                                                          -- slot start time
    end_time,                                                            -- slot end time
    primary_role,                                                        -- role that can book
    fallback_type,                                                       -- how the slot is released
    notes                                                                -- note to explain the rule
  )                                                                      -- end of the column list
SELECT                                                                   -- get the values for the new rows
  f.id,                                                                  -- facility id
  d.day_of_week,                                                         -- day number from the series below
  CASE                                                                   -- pick the start time based on the day
    WHEN d.day_of_week IN (0, 6) THEN '08:00'::time                      -- Sunday and Saturday start at 8 AM
    ELSE '16:00'::time                                                   -- all other days start at 4 PM
  END,                                                                   -- end of the start time choice
  '22:00'::time,                                                         -- ends at 10 PM, changed to time
  'everyone',                                                            -- every role can book
  'none',                                                                -- no fallback type
  'Open to students, faculty/staff, and outsiders'                       -- note
FROM                                                                     -- say where the data comes from
  facilities f                                                           -- the facilities table, called f
  CROSS JOIN generate_series(0, 6) AS d (day_of_week)                    -- join with day numbers 0 to 6, named day_of_week
WHERE                                                                    -- only use the facility that matches below
  f.name = 'Archery Range'                                               -- only the Archery Range
ON CONFLICT DO NOTHING;                                                  -- skip any row that already exists, ; ends this command
