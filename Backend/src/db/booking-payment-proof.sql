-- BOOKING PAYMENT PROOF, safe to run more than once
-- run with: node src/db/run-sql.js src/db/booking-payment-proof.sql

-- ADD PAYMENT COLUMNS TO BOOKINGS
ALTER TABLE bookings                                                    -- change the bookings table
ADD COLUMN IF NOT EXISTS payment_amount INTEGER,                        -- amount the customer paid, whole number
ADD COLUMN IF NOT EXISTS payment_journal_number VARCHAR(100),           -- journal number from the payment receipt
ADD COLUMN IF NOT EXISTS payment_screenshot TEXT,                       -- screenshot of the payment, saved as text
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,               -- when the admin checked the payment
ADD COLUMN IF NOT EXISTS payment_resolution VARCHAR(10),                -- what we decided, refund or credit
ADD COLUMN IF NOT EXISTS payment_resolution_completed_at TIMESTAMPTZ;   -- when the refund or credit was finished, ; ends this command

-- PAYMENT AMOUNT RULE
ALTER TABLE bookings                                                    -- change the bookings table
DROP CONSTRAINT IF EXISTS bookings_payment_amount_check;                -- remove old rule first, no error if run again

ALTER TABLE bookings                                                    -- change the bookings table again
ADD CONSTRAINT bookings_payment_amount_check CHECK (                    -- add the rule back, start of the check
  payment_amount IS NULL                                                -- amount can be empty, no payment yet
  OR payment_amount > 0                                                 -- or it must be more than 0
);                                                                      -- end of the check, ; ends this command

-- PAYMENT RESOLUTION RULE
ALTER TABLE bookings                                                    -- change the bookings table
DROP CONSTRAINT IF EXISTS bookings_payment_resolution_check;            -- remove old rule first, no error if run again

ALTER TABLE bookings                                                    -- change the bookings table again
ADD CONSTRAINT bookings_payment_resolution_check CHECK (                -- add the rule back, start of the check
  payment_resolution IN ('refund', 'credit')                            -- only refund or credit is allowed
  OR payment_resolution IS NULL                                         -- or it can be empty, not decided yet
);                                                                      -- end of the check, ; ends this command
