-- =============================================================
-- Backend/src/db/wednesday-release.sql   (safe to re-run)
-- =============================================================
-- Wednesday football, female-student rule:
--   * female students must book BEFORE 12:00 AM (Bhutan) on that Wednesday
--   * from 12:05 AM that Wednesday the slot opens to commercial / outsiders
-- Applies to both Wednesday female slots (standard 4-6 PM and tournament 6-8 PM).
-- Run with: node src/db/run-sql.js src/db/wednesday-release.sql
UPDATE schedule_rules
SET
  fallback_role = 'commercial',
  fallback_type = 'day_start_release',
  notes = CASE
    WHEN timetable = 'tournament' THEN 'Wednesday 6-8 PM: female students first (book before Wed 12:00 AM); opens to hiring 12:05 AM'
    ELSE 'Wednesday 4-6 PM: female students first (book before Wed 12:00 AM); opens to hiring 12:05 AM'
  END
WHERE
  facility_id = (
    SELECT
      id
    FROM
      facilities
    WHERE
      name = 'Football Ground'
  )
  AND day_of_week = 3
  AND primary_role = 'student_female';
