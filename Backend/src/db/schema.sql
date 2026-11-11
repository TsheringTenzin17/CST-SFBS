-- BASE TABLES shared by the API, feature changes live in separate migrations

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (                                      -- make the table only if it does not exist
  id SERIAL PRIMARY KEY,                                                -- auto-increasing id, main key
  full_name VARCHAR(120) NOT NULL,                                      -- full name, must be given
  email VARCHAR(150) UNIQUE NOT NULL,                                   -- email, no repeats, must be given
  student_staff_id VARCHAR(50),                                         -- student or staff id, can be empty
  role VARCHAR(20) NOT NULL CHECK (                                     -- role must be given, start of the check
    role IN ('student', 'faculty', 'outsider', 'admin')                 -- only these 4 roles are allowed
  ),                                                                    -- end of the role check
  password_hash VARCHAR(255) NOT NULL,                                  -- hashed password, must be given
  contact_number VARCHAR(30),                                           -- phone number, can be empty
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,                         -- is the email verified, default is yes
  created_at TIMESTAMP DEFAULT now()                                    -- when the user was created, default is now
);                                                                      -- end of the table, ; ends this command

-- PENDING REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS pending_registrations (                      -- make the table only if it does not exist
  token_hash CHAR(64) PRIMARY KEY,                                      -- hashed verification token, main key
  cancel_token_hash CHAR(64) UNIQUE,                                    -- hashed cancel token, no repeats
  full_name VARCHAR(120) NOT NULL,                                      -- full name, must be given
  email VARCHAR(150) UNIQUE NOT NULL,                                   -- email, no repeats, must be given
  student_staff_id VARCHAR(50),                                         -- student or staff id, can be empty
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'faculty', 'outsider')),   -- role must be student, faculty or outsider
  password_hash VARCHAR(255) NOT NULL,                                  -- hashed password, must be given
  contact_number VARCHAR(30) NOT NULL,                                  -- phone number, must be given
  organization VARCHAR(120),                                            -- organization or team name, can be empty
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('female', 'male')),     -- gender must be female or male
  expires_at TIMESTAMPTZ NOT NULL,                                      -- when this signup link stops working
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()                         -- when this record was created, default is now
);                                                                      -- end of the table, ; ends this command

CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires ON pending_registrations (expires_at);   -- index on expires_at, finds expired signups faster

-- FACILITIES TABLE
CREATE TABLE IF NOT EXISTS facilities (                                 -- make the table only if it does not exist
  id SERIAL PRIMARY KEY,                                                -- auto-increasing id, main key
  name VARCHAR(50) UNIQUE NOT NULL,                                     -- facility name, no repeats, must be given
  type VARCHAR(50),                                                     -- kind of facility, can be empty
  group_name VARCHAR(50),                                               -- group the facility belongs to, can be empty
  court_label VARCHAR(50),                                              -- court name or number, can be empty
  capacity INT,                                                         -- how many people can use it, can be empty
  location VARCHAR(100),                                                -- where the facility is, can be empty
  max_duration_minutes INT,                                             -- longest booking time in minutes, can be empty
  is_active BOOLEAN DEFAULT TRUE                                        -- is the facility in use, default is yes
);                                                                      -- end of the table, ; ends this command

-- SCHEDULE RULES TABLE
CREATE TABLE IF NOT EXISTS schedule_rules (                             -- make the table only if it does not exist
  id SERIAL PRIMARY KEY,                                                -- auto-increasing id, main key
  facility_id INT NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,   -- facility of the rule, deleted with the facility
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),    -- day number, only 0 to 6 allowed
  start_time TIME NOT NULL,                                             -- slot start time
  end_time TIME NOT NULL,                                               -- slot end time
  primary_role VARCHAR(30) NOT NULL,                                    -- role that can book first
  fallback_role VARCHAR(30),                                            -- role that can book later, can be empty
  fallback_type VARCHAR(20) DEFAULT 'none',                             -- how the slot is released, default is none
  notes TEXT,                                                           -- note to explain the rule
  timetable VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (timetable IN ('all', 'standard', 'tournament')),   -- which timetable, only these 3 values
  day_booking_cap SMALLINT CHECK (                                      -- max bookings in one day, start of the check
    day_booking_cap IS NULL                                             -- cap can be empty, no limit
    OR day_booking_cap > 0                                              -- or it must be more than 0
  )                                                                     -- end of the cap check
);                                                                      -- end of the table, ; ends this command

-- TOURNAMENT PERIODS TABLE
CREATE TABLE IF NOT EXISTS tournament_periods (                         -- make the table only if it does not exist
  id SERIAL PRIMARY KEY,                                                -- auto-increasing id, main key
  name VARCHAR(120),                                                    -- name of the tournament
  start_date DATE NOT NULL,                                             -- first day of the tournament
  end_date DATE NOT NULL,                                               -- last day of the tournament
  created_by INT REFERENCES users (id) ON DELETE SET NULL,              -- user who made it, becomes empty if user is deleted
  created_at TIMESTAMP DEFAULT now(),                                   -- when this record was created
  CHECK (end_date >= start_date)                                        -- end date cannot be before start date
);                                                                      -- end of the table, ; ends this command

-- BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (                                   -- make the table only if it does not exist
  id SERIAL PRIMARY KEY,                                                -- auto-increasing id, main key
  user_id INT NOT NULL REFERENCES users (id),                           -- user who booked
  facility_id INT NOT NULL REFERENCES facilities (id),                  -- facility that was booked
  booking_date DATE NOT NULL,                                           -- date of the booking
  start_time TIME NOT NULL,                                             -- booking start time
  end_time TIME NOT NULL,                                               -- booking end time
  status VARCHAR(20) NOT NULL DEFAULT 'pending',                        -- booking status, default is pending
  purpose TEXT,                                                         -- reason for the booking, can be empty
  released_for_commercial BOOLEAN DEFAULT FALSE,                        -- was the slot opened to commercial, default is no
  payment_amount INTEGER CHECK (                                        -- amount paid, start of the check
    payment_amount IS NULL                                              -- amount can be empty, no payment yet
    OR payment_amount > 0                                               -- or it must be more than 0
  ),                                                                    -- end of the amount check
  payment_journal_number VARCHAR(100),                                  -- journal number from the payment receipt
  payment_screenshot TEXT,                                              -- screenshot of the payment, saved as text
  payment_verified_at TIMESTAMPTZ,                                      -- when the admin checked the payment
  payment_resolution VARCHAR(10) CHECK (payment_resolution IN ('refund', 'credit')),   -- refund or credit only
  payment_resolution_completed_at TIMESTAMPTZ,                          -- when the refund or credit was finished
  created_at TIMESTAMP DEFAULT now()                                    -- when the booking was created, default is now
);                                                                      -- end of the table, ; ends this command

-- USER BOOKING ARCHIVES TABLE
CREATE TABLE IF NOT EXISTS user_booking_archives (                      -- make the table only if it does not exist
  user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,         -- user who archived, deleted with the user
  booking_id INT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,   -- booking that was archived, deleted with the booking
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),                       -- when it was archived, default is now
  PRIMARY KEY (user_id, booking_id)                                     -- one user can archive one booking only once
);                                                                      -- end of the table, ; ends this command

-- NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (                              -- make the table only if it does not exist
  id SERIAL PRIMARY KEY,                                                -- auto-increasing id, main key
  user_id INT NOT NULL REFERENCES users (id),                           -- user who gets the notification
  type VARCHAR(30),                                                     -- kind of notification, can be empty
  message TEXT,                                                         -- notification text
  is_read BOOLEAN DEFAULT FALSE,                                        -- has the user read it, default is no
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()                         -- when it was created, default is now
);                                                                      -- end of the table, ; ends this command

-- USER NOTIFICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS user_notification_preferences (              -- make the table only if it does not exist
  user_id INT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,      -- the user, main key, deleted with the user
  booking_updates BOOLEAN NOT NULL DEFAULT TRUE,                        -- get booking updates, default is yes
  game_reminders BOOLEAN NOT NULL DEFAULT TRUE,                         -- get game reminders, default is yes
  maintenance_alerts BOOLEAN NOT NULL DEFAULT TRUE,                     -- get maintenance alerts, default is yes
  updated_at TIMESTAMP NOT NULL DEFAULT now()                           -- when settings were last changed, default is now
);                                                                      -- end of the table, ; ends this command

-- SUPPORT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS support_requests (                           -- make the table only if it does not exist
  id BIGSERIAL PRIMARY KEY,                                             -- auto-increasing big id, main key
  user_id INT REFERENCES users (id) ON DELETE SET NULL,                 -- user who asked, becomes empty if user is deleted
  name VARCHAR(120) NOT NULL,                                           -- name of the person, must be given
  email VARCHAR(254) NOT NULL,                                          -- email of the person, must be given
  message TEXT NOT NULL,                                                -- the support message, must be given
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review' CHECK (          -- request status, default is pending_review, start of the check
    status IN ('pending_review', 'in_progress', 'resolved')             -- only these 3 statuses are allowed
  ),                                                                    -- end of the status check
  created_at TIMESTAMP NOT NULL DEFAULT now()                           -- when the request was created, default is now
);                                                                      -- end of the table, ; ends this command

-- AUTH TOKENS TABLE
CREATE TABLE IF NOT EXISTS auth_tokens (                                -- make the table only if it does not exist
  token_hash CHAR(64) PRIMARY KEY,                                      -- hashed token, main key
  user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,         -- user who owns the token, deleted with the user
  purpose VARCHAR(30) NOT NULL CHECK (                                  -- why the token was made, start of the check
    purpose IN ('email_verification', 'password_reset')                 -- only verify email or reset password
  ),                                                                    -- end of the purpose check
  expires_at TIMESTAMPTZ NOT NULL,                                      -- when the token stops working
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),                        -- when the token was created, default is now
  consumed_at TIMESTAMPTZ                                               -- when the token was used, empty if not used yet
);                                                                      -- end of the table, ; ends this command

-- BOOKING REMINDERS TABLE
CREATE TABLE IF NOT EXISTS booking_reminders (                          -- make the table only if it does not exist
  id BIGSERIAL PRIMARY KEY,                                             -- auto-increasing big id, main key
  booking_id INT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,   -- booking of the reminder, deleted with the booking
  scheduled_for TIMESTAMPTZ NOT NULL,                                   -- time the reminder should be sent
  lead_hours SMALLINT NOT NULL CHECK (lead_hours IN (2, 24)),           -- hours before the booking, only 2 or 24
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),                        -- when this record was created, default is now
  UNIQUE (booking_id, scheduled_for, lead_hours)                        -- same reminder cannot be added twice
);                                                                      -- end of the table, ; ends this command

-- INDEXES TO MAKE SEARCHING FASTER
CREATE INDEX IF NOT EXISTS idx_bookings_facility_date ON bookings (facility_id, booking_date);   -- find bookings by facility and date faster

CREATE INDEX IF NOT EXISTS idx_schedule_rules_facility_day ON schedule_rules (facility_id, day_of_week);   -- find rules by facility and day faster

-- BOOKING HARDENING, run ONCE on the shared database

-- STEP 1: A CANCELLED BOOKING MUST FREE ITS SLOT
-- the one booking per slot rule now ignores cancelled rows
ALTER TABLE bookings                                                    -- change the bookings table
DROP CONSTRAINT IF EXISTS unique_facility_slot;                         -- remove the old slot rule, no error if it is not there

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_slot ON bookings (facility_id, booking_date, start_time)   -- no two bookings for the same facility, date and start time
WHERE                                                                   -- only apply the index to rows that match below
  status <> 'cancelled';                                                -- rows that are not cancelled, ; ends this command

-- STEP 2: MAINTENANCE BLOCKS, used by the booking API and the admin dashboard
CREATE TABLE IF NOT EXISTS maintenance_blocks (                         -- make the table only if it does not exist
  id SERIAL PRIMARY KEY,                                                -- auto-increasing id, main key
  facility_id INT NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,   -- facility under maintenance, deleted with the facility
  start_date DATE NOT NULL,                                             -- first day of maintenance
  end_date DATE NOT NULL,                                               -- last day of maintenance
  reason TEXT,                                                          -- why maintenance is happening, can be empty
  created_by INT REFERENCES users (id),                                 -- user who added it
  created_at TIMESTAMP DEFAULT now(),                                   -- when this record was created
  CHECK (end_date >= start_date)                                        -- end date cannot be before start date
);                                                                      -- end of the table, ; ends this command

-- STEP 3: THE WEDNESDAY FACULTY SLOT NOW OPENS BY ITSELF, no admin click
UPDATE schedule_rules                                                   -- change rows in the schedule_rules table
SET                                                                     -- start of the new value
  fallback_type = 'auto_release'                                        -- the slot is now released automatically
WHERE                                                                   -- only change rows that match below
  fallback_type = 'manual_release';                                     -- rows that were released by hand, ; ends this command
