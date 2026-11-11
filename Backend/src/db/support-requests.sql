-- SUPPORT REQUESTS
-- this table saves the Help & Contact form messages
-- how to run: node src/db/run-sql.js src/db/support-requests.sql

-- create the support requests table only if it does not exist already
CREATE TABLE IF NOT EXISTS support_requests (

  -- unique id of the request, it increases by itself
  id BIGSERIAL PRIMARY KEY,

  -- id of the user who sent the request
  -- if the user is deleted, this becomes empty (NULL)
  user_id INT REFERENCES users (id) ON DELETE SET NULL,

  -- name of the person, it must be given
  name VARCHAR(120) NOT NULL,

  -- email of the person, it must be given
  email VARCHAR(254) NOT NULL,

  -- the support message, it must be given
  message TEXT NOT NULL,

  -- current status of the request
  -- by default it is pending_review
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review' CHECK (

    -- only these 3 statuses are allowed
    status IN ('pending_review', 'in_progress', 'resolved')
  ),

  -- date and time when the request was created
  -- it is set to the current time automatically
  created_at TIMESTAMP NOT NULL DEFAULT now()
);