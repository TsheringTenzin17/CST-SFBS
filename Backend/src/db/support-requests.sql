-- Persists Help & Contact submissions for existing installations.
-- Run with: node src/db/run-sql.js src/db/support-requests.sql
CREATE TABLE IF NOT EXISTS support_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'in_progress', 'resolved')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
