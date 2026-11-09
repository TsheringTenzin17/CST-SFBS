-- Thursday football, 6-8 PM: faculty may book free until Wednesday 8 PM.
-- If still available then, the slot becomes commercial for all roles.
-- Run with: node src/db/run-sql.js src/db/football-commercial-slots.sql
UPDATE schedule_rules
SET fallback_role = 'commercial',
    fallback_type = 'weekly_release',
    notes = 'Thursday 6-8 PM: free for faculty until Wednesday 8 PM, then commercial'
WHERE facility_id = (SELECT id FROM facilities WHERE name = 'Football Ground')
  AND day_of_week = 4
  AND start_time = '18:00'
  AND end_time = '20:00'
  AND primary_role = 'faculty'
  AND timetable = 'all';
