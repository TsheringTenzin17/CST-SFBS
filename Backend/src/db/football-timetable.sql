-- FOOTBALL TIMETABLE, safe to run more than once
-- moves the Football Ground to timetable given by the DSA.
--   * two timetables: 'standard' (no tournament) and 'tournament'
--   * Monday maintenance all day
--   * weekend student matches capped per day
-- run with: node src/db/run-sql.js src/db/football-timetable.sql
-- then run football-timetable-check.sql to find bookings the new rules orphan
-- timetable column: all (every day), standard, or tournament
-- day_booking_cap: max bookings per facility per day, NULL means no cap

-- STEP 1: ADD NEW COLUMNS
ALTER TABLE schedule_rules                                              -- change the schedule_rules table
ADD COLUMN IF NOT EXISTS timetable VARCHAR(20) NOT NULL DEFAULT 'all';  -- which timetable the rule is for, default is all

ALTER TABLE schedule_rules                                              -- change the schedule_rules table again
DROP CONSTRAINT IF EXISTS schedule_rules_timetable_check;               -- remove old rule first, no error if run again

ALTER TABLE schedule_rules                                              -- change the schedule_rules table again
ADD CONSTRAINT schedule_rules_timetable_check CHECK (timetable IN ('all', 'standard', 'tournament'));   -- timetable can only be these 3 values

ALTER TABLE schedule_rules                                              -- change the schedule_rules table again
ADD COLUMN IF NOT EXISTS day_booking_cap SMALLINT;                      -- max bookings allowed in one day, small whole number

ALTER TABLE schedule_rules                                              -- change the schedule_rules table again
DROP CONSTRAINT IF EXISTS schedule_rules_day_booking_cap_check;         -- remove old rule first, no error if run again

ALTER TABLE schedule_rules                                              -- change the schedule_rules table again
ADD CONSTRAINT schedule_rules_day_booking_cap_check CHECK (             -- add the rule back, start of the check
  day_booking_cap IS NULL                                               -- cap can be empty, no limit
  OR day_booking_cap > 0                                                -- or it must be more than 0
);                                                                      -- end of the check, ; ends this command

-- STEP 2: TOURNAMENT PERIODS TABLE, date ranges managed by admin
CREATE TABLE IF NOT EXISTS tournament_periods (                         -- make the table only if it does not exist
  id SERIAL PRIMARY KEY,                                                -- auto-increasing id
  name VARCHAR(120),                                                    -- name of the tournament
  start_date DATE NOT NULL,                                             -- first day of the tournament, must be given
  end_date DATE NOT NULL,                                               -- last day of the tournament, must be given
  created_by INT REFERENCES users (id) ON DELETE SET NULL,              -- user who made it, becomes empty if user is deleted
  created_at TIMESTAMP DEFAULT now(),                                   -- when this record was created
  CHECK (end_date >= start_date)                                        -- end date cannot be before start date
);                                                                      -- end of the table, ; ends this command

-- STEP 3: UNIQUE RULE INDEX MUST NOW INCLUDE THE TIMETABLE
DROP INDEX IF EXISTS unique_schedule_rule;                              -- remove the old index first, no error if run again

CREATE UNIQUE INDEX IF NOT EXISTS unique_schedule_rule ON schedule_rules (   -- make a new unique index on schedule_rules
  facility_id,                                                          -- same facility
  day_of_week,                                                          -- same day
  start_time,                                                           -- same start time
  end_time,                                                             -- same end time
  primary_role,                                                         -- same first role
  (COALESCE(fallback_role, '')),                                      -- same fallback role, empty is treated as blank text
  (COALESCE(fallback_type, '')),                                      -- same fallback type, empty is treated as blank text
  timetable                                                             -- same timetable
);                                                                      -- end of the index, ; ends this command

-- STEP 4: REPLACE ONLY THE FOOTBALL RULES, other facilities are not touched
DELETE FROM schedule_rules                                              -- delete rows from schedule_rules
WHERE                                                                   -- only rows that match the condition below
  facility_id = (                                                       -- facility must be the one found by this inner query
    SELECT                                                              -- start of the inner query
      id                                                                -- get the id of the facility
    FROM                                                                -- say which table to look in
      facilities                                                        -- the facilities table
    WHERE                                                               -- filter the facilities
      name = 'Football Ground'                                          -- only the facility named Football Ground
  );                                                                    -- end of the inner query, ; ends this command

INSERT INTO                                                             -- add new rows into the table
  schedule_rules (                                                      -- the schedule_rules table, columns listed below
    facility_id,                                                        -- which facility
    day_of_week,                                                        -- which day
    start_time,                                                         -- slot start time
    end_time,                                                           -- slot end time
    primary_role,                                                       -- role that can book first
    fallback_role,                                                      -- role that can book later
    fallback_type,                                                      -- how the slot is released to the fallback role
    timetable,                                                          -- which timetable the rule is for
    day_booking_cap,                                                    -- max bookings in one day
    notes                                                               -- note to explain the rule
  )                                                                     -- end of the column list
SELECT                                                                  -- get the values for the new rows
  f.id,                                                                 -- facility id from the facilities table
  r.dow,                                                                -- day of week from the list below
  r.s::time,                                                            -- start text changed to time
  r.e::time,                                                            -- end text changed to time
  r.role,                                                               -- first role from the list below
  r.fb_role,                                                            -- fallback role from the list below
  r.fb_type,                                                            -- fallback type from the list below
  r.tt,                                                                 -- timetable from the list below
  r.cap::smallint,                                                      -- cap changed to small number
  r.note                                                                -- note from the list below
FROM                                                                    -- say where the data comes from
  facilities f                                                          -- the facilities table, called f
  CROSS JOIN (                                                          -- join every facility with every row of the list below
    VALUES                                                              -- start of the list of rules
      # Monday (1): ground maintenance all day
      (                                                                 -- start of one rule
        1,                                                              -- day is Monday
        '06:00',                                                        -- starts at 6 AM
        '22:00',                                                        -- ends at 10 PM
        'maintenance',                                                  -- role is maintenance
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Monday: ground maintenance'                                    -- note
      ),                                                                -- end of this rule
      # Tuesday (2)
      (                                                                 -- start of one rule
        2,                                                              -- day is Tuesday
        '06:00',                                                        -- starts at 6 AM
        '08:00',                                                        -- ends at 8 AM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Tuesday: students'                                             -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        2,                                                              -- day is Tuesday
        '16:00',                                                        -- starts at 4 PM
        '18:00',                                                        -- ends at 6 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Tuesday: students'                                             -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        2,                                                              -- day is Tuesday
        '18:00',                                                        -- starts at 6 PM
        '20:00',                                                        -- ends at 8 PM
        'commercial',                                                   -- role is commercial
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Tuesday: hiring'                                               -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        2,                                                              -- day is Tuesday
        '20:00',                                                        -- starts at 8 PM
        '22:00',                                                        -- ends at 10 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'tournament',                                                   -- only in tournament timetable
        NULL,                                                           -- no cap
        'Tuesday 8-10 PM: students (department tournament)'             -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        2,                                                              -- day is Tuesday
        '20:00',                                                        -- starts at 8 PM
        '22:00',                                                        -- ends at 10 PM
        'commercial',                                                   -- role is commercial
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'standard',                                                     -- only in standard timetable
        NULL,                                                           -- no cap
        'Tuesday 8-10 PM: hiring'                                       -- note
      ),                                                                -- end of this rule
      -- Wednesday (3)
      (                                                                 -- start of one rule
        3,                                                              -- day is Wednesday
        '06:00',                                                        -- starts at 6 AM
        '08:00',                                                        -- ends at 8 AM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Wednesday: students'                                           -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        3,                                                              -- day is Wednesday
        '16:00',                                                        -- starts at 4 PM
        '18:00',                                                        -- ends at 6 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'tournament',                                                   -- only in tournament timetable
        NULL,                                                           -- no cap
        'Wednesday 4-6 PM: students (department tournament)'            -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        3,                                                              -- day is Wednesday
        '16:00',                                                        -- starts at 4 PM
        '18:00',                                                        -- ends at 6 PM
        'student_female',                                               -- female students book first
        'commercial',                                                   -- then commercial can book
        'day_start_release',                                            -- slot is released at the start of the day
        'standard',                                                     -- only in standard timetable
        NULL,                                                           -- no cap
        'Wednesday 4-6 PM: female students first (book before Wed 12:00 AM); opens to hiring 12:05 AM'   -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        3,                                                              -- day is Wednesday
        '18:00',                                                        -- starts at 6 PM
        '20:00',                                                        -- ends at 8 PM
        'student_female',                                               -- female students book first
        'commercial',                                                   -- then commercial can book
        'day_start_release',                                            -- slot is released at the start of the day
        'tournament',                                                   -- only in tournament timetable
        NULL,                                                           -- no cap
        'Wednesday 6-8 PM: female students first (book before Wed 12:00 AM); opens to hiring 12:05 AM'   -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        3,                                                              -- day is Wednesday
        '18:00',                                                        -- starts at 6 PM
        '20:00',                                                        -- ends at 8 PM
        'commercial',                                                   -- role is commercial
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'standard',                                                     -- only in standard timetable
        NULL,                                                           -- no cap
        'Wednesday 6-8 PM: hiring'                                      -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        3,                                                              -- day is Wednesday
        '20:00',                                                        -- starts at 8 PM
        '22:00',                                                        -- ends at 10 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'tournament',                                                   -- only in tournament timetable
        NULL,                                                           -- no cap
        'Wednesday 8-10 PM: students (department tournament)'           -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        3,                                                              -- day is Wednesday
        '20:00',                                                        -- starts at 8 PM
        '22:00',                                                        -- ends at 10 PM
        'commercial',                                                   -- role is commercial
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'standard',                                                     -- only in standard timetable
        NULL,                                                           -- no cap
        'Wednesday 8-10 PM: hiring'                                     -- note
      ),                                                                -- end of this rule
      -- Thursday (4)
      (                                                                 -- start of one rule
        4,                                                              -- day is Thursday
        '06:00',                                                        -- starts at 6 AM
        '08:00',                                                        -- ends at 8 AM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Thursday: students'                                            -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        4,                                                              -- day is Thursday
        '16:00',                                                        -- starts at 4 PM
        '18:00',                                                        -- ends at 6 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Thursday: students'                                            -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        4,                                                              -- day is Thursday
        '18:00',                                                        -- starts at 6 PM
        '20:00',                                                        -- ends at 8 PM
        'faculty',                                                      -- faculty can book first
        'commercial',                                                   -- then commercial can book
        'weekly_release',                                               -- slot is released weekly
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Thursday 6-8 PM: free for faculty until Wednesday 8 PM, then commercial'   -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        4,                                                              -- day is Thursday
        '20:00',                                                        -- starts at 8 PM
        '22:00',                                                        -- ends at 10 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'tournament',                                                   -- only in tournament timetable
        NULL,                                                           -- no cap
        'Thursday 8-10 PM: students (department tournament)'            -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        4,                                                              -- day is Thursday
        '20:00',                                                        -- starts at 8 PM
        '22:00',                                                        -- ends at 10 PM
        'commercial',                                                   -- role is commercial
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'standard',                                                     -- only in standard timetable
        NULL,                                                           -- no cap
        'Thursday 8-10 PM: hiring'                                      -- note
      ),                                                                -- end of this rule
      -- Friday (5)
      (                                                                 -- start of one rule
        5,                                                              -- day is Friday
        '06:00',                                                        -- starts at 6 AM
        '08:00',                                                        -- ends at 8 AM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Friday: students'                                              -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        5,                                                              -- day is Friday
        '16:00',                                                        -- starts at 4 PM
        '18:00',                                                        -- ends at 6 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Friday: students'                                              -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        5,                                                              -- day is Friday
        '18:00',                                                        -- starts at 6 PM
        '20:00',                                                        -- ends at 8 PM
        'commercial',                                                   -- role is commercial
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Friday: hiring'                                                -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        5,                                                              -- day is Friday
        '20:00',                                                        -- starts at 8 PM
        '22:00',                                                        -- ends at 10 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'tournament',                                                   -- only in tournament timetable
        NULL,                                                           -- no cap
        'Friday 8-10 PM: students (department tournament)'              -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        5,                                                              -- day is Friday
        '20:00',                                                        -- starts at 8 PM
        '22:00',                                                        -- ends at 10 PM
        'commercial',                                                   -- role is commercial
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'standard',                                                     -- only in standard timetable
        NULL,                                                           -- no cap
        'Friday 8-10 PM: hiring'                                        -- note
      ),                                                                -- end of this rule
      -- Saturday (6): max 3 student matches, then hiring 4-10 PM
      (                                                                 -- start of one rule
        6,                                                              -- day is Saturday
        '06:00',                                                        -- starts at 6 AM
        '12:00',                                                        -- ends at 12 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        3,                                                              -- max 3 bookings in this day
        'Saturday: max 3 student matches (6-8, 8-10, 10-12)'            -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        6,                                                              -- day is Saturday
        '16:00',                                                        -- starts at 4 PM
        '22:00',                                                        -- ends at 10 PM
        'commercial',                                                   -- role is commercial
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Saturday: hiring 4-10 PM'                                      -- note
      ),                                                                -- end of this rule
      -- Sunday (0): 4 slots listed but only 3 bookings, then the day closes for students
      (                                                                 -- start of one rule
        0,                                                              -- day is Sunday
        '06:00',                                                        -- starts at 6 AM
        '12:00',                                                        -- ends at 12 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        3,                                                              -- max 3 bookings in this day
        'Sunday: max 3 student bookings per day (6-8, 8-10, 10-12, 2-4)'   -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        0,                                                              -- day is Sunday
        '14:00',                                                        -- starts at 2 PM
        '16:00',                                                        -- ends at 4 PM
        'student',                                                      -- role is student
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        3,                                                              -- max 3 bookings in this day
        'Sunday: max 3 student bookings per day (6-8, 8-10, 10-12, 2-4)'   -- note
      ),                                                                -- end of this rule
      (                                                                 -- start of one rule
        0,                                                              -- day is Sunday
        '16:00',                                                        -- starts at 4 PM
        '22:00',                                                        -- ends at 10 PM
        'commercial',                                                   -- role is commercial
        NULL,                                                           -- no fallback role
        'none',                                                         -- no fallback type
        'all',                                                          -- for all timetables
        NULL,                                                           -- no cap
        'Sunday: hiring 4-10 PM'                                        -- note
      )                                                                 -- end of the last rule, no comma after it
  ) AS r (dow, s, e, role, fb_role, fb_type, tt, cap, note)             -- name the list r and name its columns
WHERE                                                                   -- only use the facility that matches below
  f.name = 'Football Ground'                                            -- only the Football Ground facility
ON CONFLICT DO NOTHING;                                                 -- skip any row that already exists, ; ends this command

