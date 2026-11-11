-- WEDNESDAY RELEASE
-- this file changes the Wednesday football rule for female students
-- female students must book BEFORE 12:00 AM (Bhutan time) on that Wednesday
-- from 12:05 AM that Wednesday, the slot opens to commercial / outsiders
-- it applies to both Wednesday female slots (standard 4-6 PM and tournament 6-8 PM)
-- it is safe to run more than once
-- how to run: node src/db/run-sql.js src/db/wednesday-release.sql

-- update the rows in the schedule_rules table
UPDATE schedule_rules
SET

  -- after the release time, the slot goes to the commercial role
  fallback_role = 'commercial',

  -- the fallback starts at the beginning of the day (12:05 AM)
  fallback_type = 'day_start_release',

  -- set the note text depending on the timetable type
  notes = CASE

    -- for the tournament timetable, use the 6-8 PM note
    WHEN timetable = 'tournament' THEN 'Wednesday 6-8 PM: female students first (book before Wed 12:00 AM); opens to hiring 12:05 AM'

    -- for every other timetable (standard), use the 4-6 PM note
    ELSE 'Wednesday 4-6 PM: female students first (book before Wed 12:00 AM); opens to hiring 12:05 AM'
  END

-- only update the rows that match all the conditions below
WHERE

  -- the rule must belong to the Football Ground facility
  -- we find the facility id by its name
  facility_id = (
    SELECT
      id
    FROM
      facilities
    WHERE
      name = 'Football Ground'
  )

  -- day_of_week 3 means Wednesday
  AND day_of_week = 3

  -- only the female student rules are updated
  AND primary_role = 'student_female';