-- FOOTBALL COMMERCIAL SLOTS
-- Thursday football 6-8 PM: faculty can book free until Wednesday 8 PM
-- if still available then, the slot becomes commercial for all roles
-- run with: node src/db/run-sql.js src/db/football-commercial-slots.sql

-- UPDATE THE THURSDAY FOOTBALL RULE
UPDATE schedule_rules                                 -- change rows in the schedule_rules table
SET                                                   -- start of the new values
  fallback_role = 'commercial',                       -- after the free time, the slot goes to commercial
  fallback_type = 'weekly_release',                   -- the slot is released weekly
  notes = 'Thursday 6-8 PM: free for faculty until Wednesday 8 PM, then commercial'   -- note to explain the rule
WHERE                                                --  only change rows that match all the conditions below
  facility_id = (                                    -- the facility must be the one found by this inner query
    SELECT                                           -- start of the inner query
      id                                             -- get the id of the facility
    FROM                                             -- say which table to look in
      facilities                                     -- the facilities table
    WHERE                                            -- filter the facilities
      name = 'Football Ground'                       -- only the facility named Football Ground
  )                                                  -- end of the inner query
  AND day_of_week = 4                                -- day must be Thursday (4)
  AND start_time = '18:00'                           -- slot starts at 6 PM
  AND end_time = '20:00'                             -- slot ends at 8 PM
  AND primary_role = 'faculty'                       -- faculty is the first role allowed to book
  AND timetable = 'all';                             -- rule is for all timetables, ; ends this command