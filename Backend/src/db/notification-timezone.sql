-- NOTIFICATION TIMESTAMPS, safe to run more than once
-- converts old UTC notification times to timezone-aware times
-- old timestamp values were written by the UTC database session
-- already converted columns are left unchanged

-- CONVERT created_at TO TIMESTAMPTZ, only if it is not converted yet 
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'notifications'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE notifications
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING created_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

-- SET DEFAULT AND NOT NULL FOR created_at
ALTER TABLE notifications                                               -- change the notifications table
ALTER COLUMN created_at                                                 -- work on the created_at column
SET DEFAULT now(),                                                      -- if no value is given, use the current time
ALTER COLUMN created_at                                                 -- work on the created_at column again
SET NOT NULL;                                                           -- value must always be given, ; ends this command
