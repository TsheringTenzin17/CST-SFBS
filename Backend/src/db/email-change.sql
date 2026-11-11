-- EMAIL CHANGE, safe to run more than once
-- lets outsider accounts change their email after confirming the new one
-- run with: node src/db/run-sql.js src/db/email-change.sql

-- ADD NEW EMAIL COLUMN TO AUTH TOKENS
ALTER TABLE auth_tokens                                                 -- change the auth_tokens table
ADD COLUMN IF NOT EXISTS new_email VARCHAR(150);                        -- the new email waiting to be confirmed, ; ends this command

-- PURPOSE RULE
ALTER TABLE auth_tokens                                                 -- change the auth_tokens table
DROP CONSTRAINT IF EXISTS auth_tokens_purpose_check;                    -- remove old rule first, no error if run again

ALTER TABLE auth_tokens                                                 -- change the auth_tokens table again
ADD CONSTRAINT auth_tokens_purpose_check CHECK (                        -- add the rule back, start of the check
  purpose IN (                                                          -- purpose can only be one of these values
    'email_verification',                                               -- token used to verify the email
    'password_reset',                                                   -- token used to reset the password
    'email_change'                                                      -- token used to confirm the new email
  )                                                                     -- end of the list of allowed values
);                                                                      -- end of the check, ; ends this command
