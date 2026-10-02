CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  student_staff_id VARCHAR(50),
  role VARCHAR(20) NOT NULL CHECK (role IN ('student','faculty','outsider','admin')),
  password_hash VARCHAR(255) NOT NULL,
  contact_number VARCHAR(30),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facilities (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(50) UNIQUE NOT NULL,
  type                  VARCHAR(50),
  group_name            VARCHAR(50),
  court_label           VARCHAR(50),
  capacity              INT,
  location              VARCHAR(100),
  max_duration_minutes  INT,
  is_active             BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS schedule_rules (
  id SERIAL PRIMARY KEY,
  facility_id INT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  primary_role VARCHAR(30) NOT NULL,
  fallback_role VARCHAR(30),
  fallback_type VARCHAR(20) DEFAULT 'none',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  facility_id INT NOT NULL REFERENCES facilities(id),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  purpose TEXT,
  released_for_commercial BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT unique_facility_slot UNIQUE (facility_id, booking_date, start_time)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  type VARCHAR(30),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_facility_date ON bookings(facility_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_schedule_rules_facility_day ON schedule_rules(facility_id, day_of_week);