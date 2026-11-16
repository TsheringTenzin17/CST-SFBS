-- Apply to existing databases to enable campus-wide booking restrictions.
CREATE TABLE IF NOT EXISTS booking_blackout_dates (
  id SERIAL PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_by INT REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_blackout_dates_period
  ON booking_blackout_dates (start_date, end_date);
