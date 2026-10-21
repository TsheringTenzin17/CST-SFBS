-- Convert existing UTC notification timestamps to timezone-aware instants.
-- Existing timestamp-without-time-zone values were written by the UTC database session.
-- Safe to run more than once: already-converted columns are left unchanged.
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
END $$;

ALTER TABLE notifications
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;
