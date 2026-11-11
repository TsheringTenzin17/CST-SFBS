-- FILE: Backend/src/db/booking-hardening.sql (safe to re-run)
-- Run this before seed.sql so schedule rule inserts do not repeat


-- 1. CANCELLED BOOKING FREES ITS SLOT
ALTER TABLE bookings                                               -- change the bookings table
DROP CONSTRAINT IF EXISTS unique_facility_slot;                    -- remove old rule that counted cancelled bookings too

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_slot ON bookings (facility_id, booking_date, start_time)  -- one booking per facility, date and time
WHERE
  status <> 'cancelled';                                           -- ignore cancelled bookings


-- 2. MAINTENANCE BLOCKS TABLE
CREATE TABLE IF NOT EXISTS maintenance_blocks (                    -- facility closed for maintenance
  id SERIAL PRIMARY KEY,                                           -- auto id
  facility_id INT NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,  -- which facility, deleted with facility
  start_date DATE NOT NULL,                                        -- first day of maintenance
  end_date DATE NOT NULL,                                          -- last day of maintenance
  reason TEXT,                                                     -- why it is closed
  created_by INT REFERENCES users (id),                            -- admin who added it
  created_at TIMESTAMP DEFAULT now(),                              -- when it was added
  CHECK (end_date >= start_date)                                   -- end date cannot be before start date
);


-- 3. MANUAL RELEASE NOW OPENS AUTOMATICALLY
UPDATE schedule_rules                                              -- change the schedule_rules table
SET
  fallback_type = 'auto_release'                                   -- new value
WHERE
  fallback_type = 'manual_release';                                -- only old manual rows


-- 4. REMOVE DUPLICATE SCHEDULE RULES
WITH
  ranked_rules AS (                                                -- temporary table with row numbers
    SELECT
      id,                                                          -- rule id
      ROW_NUMBER() OVER (                                          -- number the rows in each group
        PARTITION BY                                               -- group same rules together
          facility_id,
          day_of_week,
          start_time,
          end_time,
          primary_role,
          COALESCE(fallback_role, ''),                             -- treat NULL as empty text
          COALESCE(fallback_type, '')                              -- treat NULL as empty text
        ORDER BY
          id                                                       -- oldest rule gets number 1
      ) AS duplicate_number
    FROM
      schedule_rules
  )
DELETE FROM schedule_rules                                         -- delete the extra copies
WHERE
  id IN (
    SELECT
      id
    FROM
      ranked_rules
    WHERE
      duplicate_number > 1                                         -- keep number 1, delete the rest
  );

CREATE UNIQUE INDEX IF NOT EXISTS unique_schedule_rule ON schedule_rules (  -- stop duplicates from coming back
  facility_id,
  day_of_week,
  start_time,
  end_time,
  primary_role,
  (COALESCE(fallback_role, '')),                                   -- NULL treated as empty text
  (COALESCE(fallback_type, ''))                                    -- NULL treated as empty text
);


# 5. ARCHERY RANGE: OPEN TO EVERYONE
# Weekdays 4pm-10pm, weekends 8am-10pm
DELETE FROM schedule_rules                                         --  remove old archery rules first
WHERE
  facility_id = (
    SELECT
      id
    FROM
      facilities
    WHERE
      name = 'Archery Range'                                       -- find archery facility id
  );

INSERT INTO
  schedule_rules (                                                 -- add new archery rules
    facility_id,
    day_of_week,
    start_time,
    end_time,
    primary_role,
    fallback_type,
    notes
  )
SELECT
  f.id,                                                            -- archery facility id
  d.day_of_week,                                                   -- day 0 to 6
  CASE
    WHEN d.day_of_week IN (0, 6) THEN '08:00'::time                -- weekend starts at 8am
    ELSE '16:00'::time                                             -- weekday starts at 4pm
  END,
  '22:00'::time,                                                   -- closes at 10pm
  'everyone',                                                      -- all roles can book
  'none',                                                          -- no fallback
  'Open to students, faculty/staff, and outsiders'                 -- note
FROM
  facilities f
  CROSS JOIN generate_series(0, 6) AS d (day_of_week)              -- make a row for each day
WHERE
  f.name = 'Archery Range'
ON CONFLICT DO NOTHING;                                            -- skip if rule already exists


# 6. OTHER SPORTS: WEEKDAY AND WEEKEND RULES
# Weekday rules (Mon to Fri, 4pm-10pm)
INSERT INTO
  schedule_rules (
    facility_id,
    day_of_week,
    start_time,
    end_time,
    primary_role,
    fallback_role,
    fallback_type,
    notes
  )
SELECT
  f.id,                                                            -- facility id
  d,                                                               -- day number
  '16:00'::time,                                                   -- opens 4pm
  '22:00'::time,                                                   -- closes 10pm
  'everyone',                                                      -- all roles
  NULL,                                                            -- no fallback role
  'none',                                                          -- no fallback type
  'Weekday open to students, faculty/staff, and outsiders.'        -- note
FROM
  facilities f,
  generate_series(1, 5) AS d                                       -- days 1 to 5 (Mon to Fri)
WHERE
  f.group_name IN (                                                -- only these sports
    'Basketball Court',
    'Volleyball Court',
    'Badminton Court',
    'Table Tennis Hall'
  )
ON CONFLICT DO NOTHING;                                            -- skip if rule already exists

# Remove old weekend rules so new ones can be added
DELETE FROM schedule_rules
WHERE
  facility_id IN (
    SELECT
      id
    FROM
      facilities
    WHERE
      group_name IN (                                              -- same four sports
        'Basketball Court',
        'Volleyball Court',
        'Badminton Court',
        'Table Tennis Hall'
      )
  )
  AND day_of_week IN (0, 6);                                       -- only Sunday and Saturday

# Weekend rules (8am-10pm)
INSERT INTO
  schedule_rules (
    facility_id,
    day_of_week,
    start_time,
    end_time,
    primary_role,
    fallback_role,
    fallback_type,
    notes
  )
SELECT
  f.id,                                                            -- facility id
  d,                                                               -- day number
  '08:00'::time,                                                   -- opens 8am
  '22:00'::time,                                                   -- closes 10pm
  'everyone',                                                      -- all roles
  NULL,                                                            -- no fallback role
  'none',                                                          -- no fallback type
  'Weekend open to students, faculty/staff, and outsiders; 1hr max per booking.'  -- note
FROM
  facilities f,
  generate_series(0, 6, 6) AS d                                    -- gives 0 and 6 (Sunday and Saturday)
WHERE
  f.group_name IN (
    'Basketball Court',
    'Volleyball Court',
    'Badminton Court',
    'Table Tennis Hall'
  )
ON CONFLICT DO NOTHING;                                            -- skip if rule already exists
