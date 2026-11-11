-- PROFILE SETTINGS
-- adds persistent notification preferences for existing installations
-- run with: node src/db/run-sql.js src/db/profile-settings.sql

-- CREATE THE USER NOTIFICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS user_notification_preferences (              -- make the table only if it does not exist
  user_id INT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,      -- the user, main key, deleted when the user is deleted
  booking_updates BOOLEAN NOT NULL DEFAULT TRUE,                        -- get booking update notifications, default is yes
  game_reminders BOOLEAN NOT NULL DEFAULT TRUE,                         -- get game reminder notifications, default is yes
  maintenance_alerts BOOLEAN NOT NULL DEFAULT TRUE,                     -- get maintenance alert notifications, default is yes
  updated_at TIMESTAMP NOT NULL DEFAULT now()                           -- when these settings were last changed, default is now
);                                                                      -- end of the table, ; ends this command
