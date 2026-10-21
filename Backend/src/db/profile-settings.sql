-- Adds persistent notification preferences for existing installations.
-- Run with: node src/db/run-sql.js src/db/profile-settings.sql
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  booking_updates BOOLEAN NOT NULL DEFAULT true,
  game_reminders BOOLEAN NOT NULL DEFAULT true,
  maintenance_alerts BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
