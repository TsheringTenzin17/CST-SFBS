-- NOTIFICATION TIMESTAMPS, safe to run more than once
-- converts old UTC notification times to timezone-aware times
-- old timestamp values were written by the UTC database session
-- already converted columns are left unchanged

-- CONVERT created_at TO TIMESTAMPTZ, only if it is not converted yet
DO $$                                                                   -- start of a code block, $$ marks where it begins
BEGIN                                                                   -- start of the steps inside the block
  IF EXISTS (                                                           -- check if a matching column is found below
    SELECT 1 FROM information_schema.columns                            -- look in the list of all table columns
    WHERE table_schema = current_schema()                               -- only in the current schema
      AND table_name = 'notifications'                                  -- only the notifications table
      AND column_name = 'created_at'                                    -- only the created_at column
      AND data_type = 'timestamp without time zone'                     -- only if it still has no time zone
  ) THEN                                                                -- if found, do the step below
    ALTER TABLE notifications                                           -- change the notifications table
      ALTER COLUMN created_at TYPE TIMESTAMPTZ                          -- change created_at to a timezone-aware time
      USING created_at AT TIME ZONE 'UTC';                              -- read the old values as UTC when converting
  END IF;                                                               -- end of the if check
END $$;                                                                 -- end of the code block, ; ends this command

-- SET DEFAULT AND NOT NULL FOR created_at
ALTER TABLE notifications                                               -- change the notifications table
ALTER COLUMN created_at                                                 -- work on the created_at column
SET DEFAULT now(),                                                      -- if no value is given, use the current time
ALTER COLUMN created_at                                                 -- work on the created_at column again
SET NOT NULL;                                                           -- value must always be given, ; ends this command
