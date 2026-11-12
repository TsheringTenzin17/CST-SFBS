// ===================== 1. IMPORTS =====================
const express = require('express');                                                       // web framework to make routes
const bcrypt = require('bcryptjs');                                                       // to hash and check passwords
const crypto = require('crypto');                                                         // for random tokens and hashing
const pool = require('../db');                                                            // our database connection
const { authenticate, createSessionToken } = require('../auth');                          // login check and login token maker
const { sendEmail } = require('../email');                                                // helper to send emails
const router = express.Router();                                                          // router to group all routes in this file

// ===================== 2. CONSTANTS =====================
const COLLEGE_EMAIL = /^[^@\s]+\.cst@rub\.edu\.bt$/i;                                     // college email like name.cst@rub.edu.bt
const OUTSIDER_EMAIL = /^[^@\s]+@gmail\.com$/i;                                           // outsiders must use gmail
const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/;                                             // phone: digits, spaces, + - ( ), 7 to 20 characters
// website link for emails, remove last slashes
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

// ===================== 3. HELPER FUNCTIONS =====================

// makes a sha256 hash of a token so we do not save the real token
function hashToken(token) {                                                               // start of hashToken
  return crypto.createHash('sha256').update(token).digest('hex');                         // hash the token and return it as text
}                                                                                         // end of hashToken

// makes a new token for a user (verify email, reset password etc.)
async function issueToken(userId, purpose, expiresInHours) {                              // start of issueToken
  const token = crypto.randomBytes(32).toString('hex');                                   // make a random 64 character token
  // SQL below: delete the old unused token of the same purpose for this user
  await pool.query(                                                                       // run the query
    `DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, purpose],                                                                    // values for $1 and $2
  );                                                                                      // end of query
  // SQL below: save the new token hash with its expiry time (now + hours)
  await pool.query(                                                                       // run the query
    `INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
     VALUES ($1, $2, $3, now() + ($4 * interval '1 hour'))`,
    [hashToken(token), userId, purpose, expiresInHours],                                  // values for $1 to $4
  );                                                                                      // end of query
  return token;                                                                           // give back the real token for the email link
}                                                                                         // end of issueToken

// same as issueToken but also saves the new email this link will confirm
async function issueEmailChangeToken(userId, newEmail, expiresInHours) {                  // start of issueEmailChangeToken
  const token = crypto.randomBytes(32).toString('hex');                                   // make a random 64 character token
  // SQL below: delete the old unused email change token of this user
  await pool.query(                                                                       // run the query
    `DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = 'email_change' AND consumed_at IS NULL`,
    [userId],                                                                             // value for $1
  );                                                                                      // end of query
  // SQL below: save the new token together with the new email
  await pool.query(                                                                       // run the query
    `INSERT INTO auth_tokens (token_hash, user_id, purpose, new_email, expires_at)
     VALUES ($1, $2, 'email_change', $3, now() + ($4 * interval '1 hour'))`,
    [hashToken(token), userId, newEmail, expiresInHours],                                 // values for $1 to $4
  );                                                                                      // end of query
  return token;                                                                           // give back the real token for the email link
}                                                                                         // end of issueEmailChangeToken

// makes the full frontend link with the token, like /verify-email?token=abc
function actionUrl(path, token) {                                                         // start of actionUrl
  const url = new URL(path, `${FRONTEND_URL}/`);                                          // join website link and page path
  url.searchParams.set('token', token);                                                   // add ?token=... to the link
  return url.toString();                                                                  // return the link as text
} 

// finds the role from a college email: only numbers = student, name = faculty
function roleFromCollegeEmail(email) {                                                    // start of roleFromCollegeEmail
  const local = email.split('.cst@')[0];                                                  // take the part before .cst@
  return /^\d+$/.test(local) ? 'student' : 'faculty';                                     // digits only = student, else faculty
}                                                                                         // end of roleFromCollegeEmail

// ===================== 4. REGISTRATION ROUTES =====================

// ---------- POST /register : start a new registration ----------
router.post('/register', async (req, res) => {                                            // start of register route
  const {                                                                                 // take these values from the request
    full_name,                                                                            // user's full name
    password,                                                                             // user's password
    contact_number,                                                                       // user's phone number
    organization,                                                                         // organization name (for outsiders)
    role: requestedRole,                                                                  // role the user picked on the form
    gender,                                                                               // female or male
  } = req.body;                                                                           // all values come from the request body
  const email = (req.body.email || '').trim().toLowerCase();                              // clean email: remove spaces, make lowercase

  if (!full_name || !email || !password) {                                                // name, email, password are compulsory
    // send error
    return res.status(400).json({ error: 'full_name, email and password are required' });
  }                                                                                       // end of check
  if (password.length < 8)                                                                // password must be at least 8 characters
    return res.status(400).json({ error: 'Password must be at least 8 characters' });     // send error
  if (!/^(?:16|17|77)\d{6}$/.test(String(contact_number || ''))) {                        // phone must be 8 digits starting with 16, 17 or 77
    return res
      .status(400)                                                                        // bad request
      // send error
      .json({ error: 'Enter an 8-digit Bhutan mobile number starting with 16, 17 or 77' });
  }                                                                                       // end of check

  if (!['female', 'male'].includes(gender)) {                                             // gender must be female or male
    return res.status(400).json({ error: 'Select your gender (female or male).' });       // send error
  }                                                                                       // end of check

  // role comes from the email, not from the request (so nobody can become admin)
  let role;                                                                               // will store the final role
  let student_staff_id = null;                                                            // only students get an ID
  if (COLLEGE_EMAIL.test(email)) {                                                        // case 1: user used a college email
    if (requestedRole === 'outsider') {                                                   // college email cannot be outsider
      // send error
      return res.status(400).json({ error: 'College emails must register as Student or Staff' });
    }                                                                                     // end of check
    role = roleFromCollegeEmail(email);                                                   // find real role from the email
    if (requestedRole && requestedRole !== role) {                                        // picked role does not match the email
      return res.status(400).json({                                                       // send error
        error:
          role === 'student'
            ? 'This is a student email. Pick the Student option.'                         // message for student email
            : 'This is a staff email. Pick the Staff option.',                            // message for staff email
      });                                                                                 // end of response
    }                                                                                     // end of check
    if (role === 'student') student_staff_id = email.split('.cst@')[0];                   // student ID is the number in the email
  } else {                                                                                // case 2: not a college email
    if (requestedRole === 'student' || requestedRole === 'faculty') {                     // student/staff must use college email
      return res
        .status(400)                                                                      // bad request
        // send error
        .json({ error: 'Student and staff accounts need a college email ending .cst@rub.edu.bt' });
    }                                                                                     // end of check
    if (!OUTSIDER_EMAIL.test(email)) {                                                    // outsider must use gmail
      return res.status(400).json({                                                       // send error
        error:
          // error text
          'Use your college email (.cst@rub.edu.bt) or a Gmail address (@gmail.com) to register.',
      });                                                                                 // end of response
    }                                                                                     // end of check
    role = 'outsider';                                                                    // everyone else is an outsider
  } 

  // only outsiders need organization name
  const organizationName = role === 'outsider' ? String(organization || '').trim() : null;
  if (role === 'outsider' && !organizationName) {                                         // outsider left it empty
    return res.status(400).json({                                                         // send error
      // error text
      error: 'Enter your organization name, or your team name if you are not with an organization.',
    });                                                                                   // end of response
  }                                                                                       // end of check
  if (organizationName && organizationName.length > 120) {                                // name is too long
    return res
      .status(400)                                                                        // bad request
      .json({ error: 'Organization or team name must be 120 characters or fewer' });      // send error
  }  

  let client;                                                                             // database connection for the transaction
  let transactionStarted = false;                                                         // remember if BEGIN was run, so we know when to ROLLBACK
  let verificationToken;                                                                  // token for the verify email link
  let cancelToken;                                                                        // token to cancel the registration
  const passwordHash = await bcrypt.hash(password, 10);                                   // hash the password before saving
  try {                                                                                   // start of main work
    client = await pool.connect();                                                        // get one connection from the pool
    await client.query('BEGIN');                                                          // start the transaction
    transactionStarted = true;                                                            // remember that it started
    // lock this email so two requests cannot register it at the same time
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [                    // lock query
      `registration-email:${email}`,                                                      // lock name for this email
    ]);                                                                                   // end of lock
    // lock this phone number for the same reason
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [                    // lock query
      `registration-phone:${contact_number}`,                                             // lock name for this phone
    ]);                                                                                   // end of lock
    // SQL below: delete old expired pending registrations (except this email)
    await client.query(                                                                   // run the query
      'DELETE FROM pending_registrations WHERE expires_at <= now() AND email <> $1',
      [email],                                                                            // value for $1
    );

    // check if an account with this email already exists
    const existingAccount = await client.query(
      'SELECT 1 FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [email],                                                                            // value for $1
    );
    if (existingAccount.rows.length > 0) {                                                // account already exists
      await client.query('ROLLBACK');                                                     // undo everything
      transactionStarted = false;                                                         // transaction is finished
      return res.status(409).json({
        // send error
        error: 'An account with this email already exists. Sign in or request a verification link.',
      });
    }

    // check if the phone number is already used (in users or other pending registrations)
    const duplicatePhone = await client.query(
      `SELECT 1 FROM (
         SELECT regexp_replace(contact_number, '[^0-9]', '', 'g') AS digits FROM users
         UNION ALL
         SELECT regexp_replace(contact_number, '[^0-9]', '', 'g') AS digits
         FROM pending_registrations WHERE email <> $2
       ) existing_numbers
       WHERE digits IN ($1, '975' || $1)
       LIMIT 1`,
      [contact_number, email],                                                            // values for $1 and $2
    );
    if (duplicatePhone.rows.length > 0) {                                                 // phone is already used
      await client.query('ROLLBACK');                                                     // undo everything
      transactionStarted = false;                                                         // transaction is finished
      return res
        .status(409)
        // send error
        .json({ error: 'This phone number is already registered or awaiting verification' });
    }

    if (student_staff_id) {                                                               // for students, check the ID is not used
      // look in users and in other pending registrations
      const taken = await client.query(
        `SELECT 1 FROM users WHERE student_staff_id = $1
         UNION ALL
         SELECT 1 FROM pending_registrations WHERE student_staff_id = $1 AND email <> $2
         LIMIT 1`,
        [student_staff_id, email],                                                        // values for $1 and $2
      );
      if (taken.rows.length > 0) {                                                        // ID is already used
        await client.query('ROLLBACK');                                                   // undo everything
        transactionStarted = false;                                                       // transaction is finished
        return res.status(409).json({
          error:
            // send error
            'An account with this Student / Staff ID already exists or is awaiting verification',
        });
      }
    }

    verificationToken = crypto.randomBytes(32).toString('hex');                           // make the verify token
    cancelToken = crypto.randomBytes(32).toString('hex');                                 // make the cancel token
    // save the pending registration (if email already exists here, update it)
    await client.query(
      `INSERT INTO pending_registrations
         (token_hash, cancel_token_hash, full_name, email, student_staff_id, role, password_hash, contact_number, organization, gender, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now() + interval '24 hours')
       ON CONFLICT (email) DO UPDATE SET
         token_hash = EXCLUDED.token_hash,
         cancel_token_hash = EXCLUDED.cancel_token_hash,
         full_name = EXCLUDED.full_name,
         student_staff_id = EXCLUDED.student_staff_id,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash,
         contact_number = EXCLUDED.contact_number,
         organization = EXCLUDED.organization,
         gender = EXCLUDED.gender,
         expires_at = EXCLUDED.expires_at,
         created_at = now()`,
      [
        hashToken(verificationToken),                                                     // $1 verify token hash
        hashToken(cancelToken),                                                           // $2 cancel token hash
        full_name.trim(),                                                                 // $3 name without extra spaces
        email,                                                                            // $4 email
        student_staff_id || null,                                                         // $5 student ID or null
        role,                                                                             // $6 role
        passwordHash,                                                                     // $7 hashed password
        contact_number,                                                                   // $8 phone number
        organizationName,                                                                 // $9 organization name
        gender,                                                                           // $10 gender
      ],
    );
    await client.query('COMMIT');                                                         // save everything permanently
    transactionStarted = false;                                                           // transaction is finished
    client.release();                                                                     // give the connection back to the pool
    client = null;                                                                        // so finally does not release it again
  } catch (err) {
    if (client && transactionStarted) await client.query('ROLLBACK');                     // undo changes if it failed in the middle
    if (err.code === '23505')                                                             // 23505 means duplicate value in database
      return res
        .status(409)
        .json({ error: 'An account with this email or phone number already exists' });    // send error
    console.error(err);                                                                   // show the error in console
    return res.status(500).json({ error: 'Registration could not be started' });          // send general error
  } finally {
    client?.release();                                                                    // always give the connection back
  }

  try {
    // send the verification email
    await sendEmail({
      to: email,                                                                          // send to the user's email
      subject: 'Verify your CST-SFBS account',                                            // email title
      // email message with link
      text: `Hello ${full_name.trim()},\n\nVerify your email address within 24 hours:\n${actionUrl('/verify-email', verificationToken)}\n\nYour account will only be created after you verify this email.`,
    });
    res.status(202).json({                                                                // email sent, tell the frontend
      pending_verification: true,                                                         // waiting for verification
      email,                                                                              // the email
      role,                                                                               // the role
      verification_email_sent: true,                                                      // email was sent
      cancel_token: cancelToken,                                                          // token to cancel registration
    });
  } catch (emailError) {
    console.error(emailError);                                                            // show the email error in console
    res.status(202).json({                                                                // registration saved but email failed
      pending_verification: true,                                                         // waiting for verification
      email,                                                                              // the email
      role,                                                                               // the role
      verification_email_sent: false,                                                     // email was NOT sent
      cancel_token: cancelToken,                                                          // token to cancel registration
    });
  }
});

// ---------- POST /resend-verification : send the verify link again ----------
router.post('/resend-verification', async (req, res) => {
  // clean email if it is text
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ error: 'Email is required' });                // email is compulsory

  try {
    // first check if this email is in pending registrations
    const pendingResult = await pool.query(
      'SELECT full_name, email FROM pending_registrations WHERE LOWER(email) = $1',
      [email],                                                                            // value for $1
    );
    if (pendingResult.rows.length > 0) {                                                  // found a pending registration
      const pending = pendingResult.rows[0];                                              // get that registration
      const token = crypto.randomBytes(32).toString('hex');                               // make a new token
      // save the new token and give 24 more hours
      await pool.query(
        `UPDATE pending_registrations
         SET token_hash = $1, expires_at = now() + interval '24 hours', created_at = now()
         WHERE LOWER(email) = $2`,
        [hashToken(token), email],                                                        // values for $1 and $2
      );
      // send the new verification email
      await sendEmail({
        to: pending.email,                                                                // send to the pending email
        subject: 'Verify your CST-SFBS account',                                          // email title
        // email message with link
        text: `Hello ${pending.full_name},\n\nVerify your email address within 24 hours:\n${actionUrl('/verify-email', token)}\n\nYour account will only be created after you verify this email.`,
      });
      return res.json({                                                                   // same message always, so nobody can guess which emails exist
        message:
          'If a pending registration exists for that email, a verification link has been sent.',
      });
    }

    // if not pending, check for an old account that is not verified
    const result = await pool.query(
      'SELECT id, full_name, email FROM users WHERE LOWER(email) = $1 AND email_verified = false',
      [email],                                                                            // value for $1
    );
    if (result.rows.length > 0) {                                                         // found an unverified account
      const user = result.rows[0];                                                        // get the user
      const token = await issueToken(user.id, 'email_verification', 24);                  // new token valid for 24 hours
      // send the verification email
      await sendEmail({
        to: user.email,                                                                   // send to the user's email
        subject: 'Verify your CST-SFBS account',                                          // email title
        // email message with link
        text: `Hello ${user.full_name},\n\nVerify your email address within 24 hours:\n${actionUrl('/verify-email', token)}\n\nIf you did not create this account, you can ignore this message.`,
      });
    }
    res.json({                                                                            // same message even if no account was found
      message: 'If an unverified account exists for that email, a verification link has been sent.',
    });
  } catch (err) {
    console.error(err);                                                                   // show the error in console
    res
      .status(503)
      // send error
      .json({ error: 'Could not send the verification email. Please try again later.' });
  }
});

// ---------- POST /cancel-registration : cancel a pending registration ----------
router.post('/cancel-registration', async (req, res) => {
  // clean email if it is text
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const cancelToken = req.body.cancel_token;                                              // get the cancel token
  // email needed, token must be 64 hex characters
  if (!email || typeof cancelToken !== 'string' || !/^[a-f0-9]{64}$/i.test(cancelToken)) {
    return res.status(400).json({ error: 'Invalid pending registration' });               // send error
  }

  try {
    // delete the pending registration if email and cancel token match and it is not expired
    const result = await pool.query(
      `DELETE FROM pending_registrations
       WHERE LOWER(email) = $1 AND cancel_token_hash = $2 AND expires_at > now()
       RETURNING email`,
      [email, hashToken(cancelToken)],                                                    // values for $1 and $2
    );
    if (result.rows.length === 0) {                                                       // nothing deleted
      return res
        .status(404)
        .json({ error: 'This pending registration was not found or has expired.' });      // send error
    }
    res.json({ message: 'Registration cancelled. No account was created.' });             // cancelled successfully
  } catch (err) {
    console.error(err);                                                                   // show the error in console
    res.status(500).json({ error: 'Could not cancel this registration' });                // send error
  }
});

// ---------- POST /verify-email : user opens the link from the email ----------
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;                                                             // get the token
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {                      // token must be 64 hex characters
    return res.status(400).json({ error: 'Invalid or expired verification link' });       // send error
  }
  const client = await pool.connect();                                                    // get a connection for the transaction
  try {
    await client.query('BEGIN');                                                          // start the transaction
    const tokenHash = hashToken(token);                                                   // hash token to match the database
    // look for a pending registration with this token (lock the row)
    const pendingResult = await client.query(
      `SELECT full_name, email, student_staff_id, role, password_hash,
              contact_number, organization, gender, expires_at
       FROM pending_registrations
       WHERE token_hash = $1 AND expires_at > now()
       FOR UPDATE`,
      [tokenHash],                                                                        // value for $1
    );

    if (pendingResult.rows.length > 0) {                                                  // case 1: new registration, create the real account now
      const pending = pendingResult.rows[0];                                              // get the pending registration
      // check again that email, ID or phone is not used by a user
      const duplicate = await client.query(
        `SELECT 1 FROM users
         WHERE LOWER(email) = $1
            OR ($2::varchar IS NOT NULL AND student_staff_id = $2)
            OR regexp_replace(contact_number, '[^0-9]', '', 'g') IN ($3, '975' || $3)
         LIMIT 1`,
        [pending.email, pending.student_staff_id, pending.contact_number],                // values for $1 to $3
      );
      if (duplicate.rows.length > 0) {                                                    // something is already used
        await client.query('ROLLBACK');                                                   // undo everything
        return res.status(409).json({
          // send error
          error: 'These registration details are already in use. Please contact support.',
        });
      }

      // create the real user account (email already verified)
      const inserted = await client.query(
        `INSERT INTO users (full_name, email, student_staff_id, role, password_hash,
                            contact_number, organization, gender, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
         RETURNING id`,
        [
          pending.full_name,                                                              // $1 name
          pending.email,                                                                  // $2 email
          pending.student_staff_id,                                                       // $3 student ID
          pending.role,                                                                   // $4 role
          pending.password_hash,                                                          // $5 hashed password
          pending.contact_number,                                                         // $6 phone
          pending.organization,                                                           // $7 organization
          pending.gender,                                                                 // $8 gender
        ],
      );
      // save a used token record, so opening the link again says already verified
      await client.query(
        `INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at, consumed_at)
         VALUES ($1, $2, 'email_verification', $3, now())`,
        [tokenHash, inserted.rows[0].id, pending.expires_at],                             // values for $1 to $3
      );
      // remove the pending registration
      await client.query('DELETE FROM pending_registrations WHERE token_hash = $1', [tokenHash]);
      await client.query('COMMIT');                                                       // save everything permanently
      // success
      return res.json({ message: 'Email verified. Your account is ready; you can now sign in.' });
    }

    // case 2: old account not verified yet, so mark the token as used
    const result = await client.query(
      `UPDATE auth_tokens SET consumed_at = now()
       WHERE token_hash = $1 AND purpose = 'email_verification'
         AND consumed_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [tokenHash],                                                                        // value for $1
    );
    if (result.rows.length === 0) {                                                       // no valid token found
      // maybe the link was already used and the email is already verified
      const alreadyVerified = await client.query(
        `SELECT 1 FROM auth_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = $1 AND t.purpose = 'email_verification'
           AND t.consumed_at IS NOT NULL AND u.email_verified = true`,
        [tokenHash],                                                                      // value for $1
      );
      if (alreadyVerified.rows.length > 0) {                                              // already verified
        await client.query('COMMIT');                                                     // finish the transaction
        return res.json({ message: 'Email is already verified. You can sign in.' });      // friendly message, not an error
      }
      await client.query('ROLLBACK');                                                     // undo everything
      return res.status(400).json({ error: 'Invalid or expired verification link' });     // link is wrong or expired
    }
    // mark the user's email as verified
    await client.query('UPDATE users SET email_verified = true WHERE id = $1', [
      result.rows[0].user_id,                                                             // the user id from the token
    ]);
    await client.query('COMMIT');                                                         // save everything permanently
    res.json({ message: 'Email verified. You can now sign in.' });                        // success
  } catch (err) {
    await client.query('ROLLBACK');                                                       // undo changes if it failed
    console.error(err);                                                                   // show the error in console
    res.status(500).json({ error: 'Could not verify email' });                            // send error
  } finally {
    client.release();                                                                     // always give the connection back
  }
});

// ===================== 5. LOGIN AND PASSWORD ROUTES =====================

// ---------- POST /login : sign in with email or student/staff ID ----------
router.post('/login', async (req, res) => {
  const identifier = (req.body.email || req.body.identifier || '').trim();                // email or ID typed by user
  const { password } = req.body;                                                          // password typed by user
  if (!identifier || !password)                                                           // both are compulsory
    return res.status(400).json({ error: 'email (or ID) and password are required' });    // send error

  try {
    // find the user by email or by student/staff ID
    const result = await pool.query(
      `SELECT id, full_name, email, role, password_hash, email_verified,
              student_staff_id, contact_number, organization, gender, is_active FROM users
       WHERE LOWER(email) = LOWER($1) OR student_staff_id = $1 LIMIT 1`,
      [identifier],                                                                       // value for $1
    );
    if (result.rows.length === 0)                                                         // no user found
      return res.status(401).json({ error: 'Invalid email/ID or password' });             // send error

    const row = result.rows[0];                                                           // get the user row
    let ok;                                                                               // will be true if password is correct
    if (row.password_hash.startsWith('$2')) {                                             // bcrypt hashes start with $2
      ok = await bcrypt.compare(password, row.password_hash);                             // compare typed password with the hash
    } else {
      ok = row.password_hash === password;                                                // old account with plain text password, compare directly
      if (ok) {                                                                           // if correct, upgrade it to a bcrypt hash
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
          await bcrypt.hash(password, 10),                                                // new hashed password
          row.id,                                                                         // the user id
        ]);
      }
    }
    if (!ok) return res.status(401).json({ error: 'Invalid email/ID or password' });      // wrong password
    if (!row.email_verified) {                                                            // email must be verified to login
      return res.status(403).json({
        error:
          // send error
          'Verify your email before signing in. You can request another verification email from the registration page.',
        code: 'EMAIL_NOT_VERIFIED',                                                       // code for the frontend
      });
    }

    if (row.is_active === false) {                                                        // suspended account cannot login
      return res
        .status(403)
        // send error
        .json({ error: 'This account has been suspended. Please contact the DSA office.' });
    }

    const { password_hash, email_verified, is_active, ...user } = row;                    // remove private fields from the user
    res.json({ user, token: createSessionToken(user.id) });                               // send the user and a login token
  } catch (err) {
    console.error(err);                                                                   // show the error in console
    res.status(500).json({ error: 'Login failed' });                                      // send error
  }
});

// ---------- POST /forgot-password : send a password reset link ----------
router.post('/forgot-password', async (req, res) => {
  // clean email if it is text
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ error: 'Email is required' });                // email is compulsory

  try {
    // find a verified user with this email
    const result = await pool.query(
      'SELECT id, full_name, email FROM users WHERE LOWER(email) = $1 AND email_verified = true',
      [email],                                                                            // value for $1
    );
    if (result.rows.length > 0) {                                                         // user found
      const user = result.rows[0];                                                        // get the user
      const token = await issueToken(user.id, 'password_reset', 1);                       // reset token valid for 1 hour
      const resetUrl = actionUrl('/reset-password', token);                               // make the reset link
      const emailConfigured =                                                             // check if email settings are set
        (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) ||                     // gmail settings
        (process.env.RESEND_API_KEY && process.env.RESEND_FROM);                          // or resend settings
      if (!emailConfigured) {                                                             // email is not set up
        if (process.env.NODE_ENV !== 'production') {                                      // in development, show the link directly
          return res.json({
            message:
              // tell the developer
              'Email delivery is not configured. Use this local development reset link (valid for one hour).',
            reset_url: resetUrl,                                                          // the reset link for testing
          });
        }
        // in production this is an error
        throw new Error('Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
      }
      // send the reset email
      await sendEmail({
        to: user.email,                                                                   // send to the user's email
        subject: 'Reset your CST-SFBS password',                                          // email title
        // email message with link
        text: `Hello ${user.full_name},\n\nReset your password within one hour:\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`,
      });
    }
    res.json({                                                                            // same message even if the email does not exist
      message:
        'If a verified account exists for that email, password reset instructions have been sent.',
    });
  } catch (err) {
    console.error(err);                                                                   // show the error in console
    res
      .status(503)
      // send error
      .json({ error: 'Could not send password reset instructions. Please try again later.' });
  }
});

// ---------- POST /reset-password : set a new password using the link ----------
router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body;                                               // get token and new password
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {                      // token must be 64 hex characters
    return res.status(400).json({ error: 'Invalid or expired password reset link' });     // send error
  }
  if (typeof new_password !== 'string' || new_password.length < 8) {                      // new password must be text, 8+ characters
    return res.status(400).json({ error: 'Password must be at least 8 characters' });     // send error
  }

  const client = await pool.connect();                                                    // get a connection for the transaction
  try {
    const passwordHash = await bcrypt.hash(new_password, 10);                             // hash the new password
    await client.query('BEGIN');                                                          // start the transaction
    // mark the reset token as used (only if valid and not expired)
    const result = await client.query(
      `UPDATE auth_tokens SET consumed_at = now()
       WHERE token_hash = $1 AND purpose = 'password_reset'
         AND consumed_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [hashToken(token)],                                                                 // value for $1
    );
    if (result.rows.length === 0) {                                                       // no valid token found
      await client.query('ROLLBACK');                                                     // undo everything
      return res.status(400).json({ error: 'Invalid or expired password reset link' });   // send error
    }
    // save the new password hash for that user
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,                                                                       // new hashed password
      result.rows[0].user_id,                                                             // the user id from the token
    ]);
    await client.query('COMMIT');                                                         // save everything permanently
    // success
    res.json({ message: 'Password reset successfully. Sign in with your new password.' });
  } catch (err) {
    await client.query('ROLLBACK');                                                       // undo changes if it failed
    console.error(err);                                                                   // show the error in console
    res.status(500).json({ error: 'Could not reset password' });                          // send error
  } finally {
    client.release();                                                                     // always give the connection back
  }
});

// ---------- PATCH /password : change password while logged in ----------
router.patch('/password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;                                    // get old and new password
  if (
    typeof current_password !== 'string' ||                                               // old password must be text
    !current_password ||                                                                  // old password must not be empty
    typeof new_password !== 'string'                                                      // new password must be text
  ) {
    return res.status(400).json({ error: 'Current and new passwords are required' });     // send error
  }
  if (new_password.length < 8) {                                                          // new password must be 8+ characters
    // send error
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    // get saved password hash
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    // user not found
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });

    const passwordHash = result.rows[0].password_hash;                                    // saved password hash
    const validCurrentPassword = passwordHash.startsWith('$2')                            // is it a bcrypt hash?
      ? await bcrypt.compare(current_password, passwordHash)                              // yes: compare with bcrypt
      : current_password === passwordHash;                                                // no: old plain text, compare directly
    if (!validCurrentPassword)                                                            // old password is wrong
      return res.status(400).json({ error: 'Current password is incorrect' });            // send error

    const newPasswordHash = await bcrypt.hash(new_password, 10);                          // hash the new password
    // save the new password hash
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newPasswordHash,                                                                    // new hashed password
      req.user.id,                                                                        // logged in user id
    ]);
    res.json({ message: 'Password updated successfully' });                               // success
  } catch (err) {
    console.error(err);                                                                   // show the error in console
    res.status(500).json({ error: 'Failed to update password' });                         // send error
  }
});

// ===================== 6. PROFILE ROUTES (must be logged in) =====================

// ---------- GET /me : get the current logged in user ----------
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });                                                           // authenticate already put the user in req.user
});

// ---------- GET /profile : get profile and notification settings ----------
router.get('/profile', authenticate, async (req, res) => {
  try {
    const [profile, preferences] = await Promise.all([                                    // run both queries at the same time
      // get the user's profile details
      pool.query(
        `SELECT id, full_name, email, role, student_staff_id, contact_number,
                organization, gender, to_char(created_at, 'YYYY-MM-DD') AS joined
         FROM users WHERE id = $1`,
        [req.user.id],                                                                    // value for $1
      ),
      // get the user's notification settings
      pool.query(
        `SELECT booking_updates, game_reminders, maintenance_alerts
         FROM user_notification_preferences WHERE user_id = $1`,
        [req.user.id],                                                                    // value for $1
      ),
    ]);
    // user not found
    if (profile.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    let pendingEmail = null;                                                              // email waiting for confirmation (empty by default)
    try {
      // look for an email change that is not confirmed yet
      const pending = await pool.query(
        `SELECT new_email FROM auth_tokens
         WHERE user_id = $1 AND purpose = 'email_change'
           AND consumed_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [req.user.id],                                                                    // value for $1
      );
      pendingEmail = pending.rows[0]?.new_email || null;                                  // use the new email if found
    } catch (pendingError) {
      console.error('Could not look up pending email change:', pendingError.message);     // do not break the profile page, just log
    }
    res.json({
      profile: { ...profile.rows[0], pending_email: pendingEmail },                       // profile plus the pending email
      preferences: preferences.rows[0] || {                                               // saved settings, or default all on
        booking_updates: true,                                                            // booking updates on
        game_reminders: true,                                                             // game reminders on
        maintenance_alerts: true,                                                         // maintenance alerts on
      },
    });
  } catch (err) {
    console.error(err);                                                                   // show the error in console
    res.status(500).json({ error: 'Failed to fetch profile settings' });                  // send error
  }
});

// ---------- PATCH /profile : update name, phone and gender ----------
router.patch('/profile', authenticate, async (req, res) => {
  const { full_name, contact_number, gender } = req.body;                                 // get the values to update
  // name is needed, max 120 characters
  if (typeof full_name !== 'string' || !full_name.trim() || full_name.trim().length > 120) {
    // send error
    return res.status(400).json({ error: 'Name is required and must be 120 characters or fewer' });
  }
  if (contact_number != null && typeof contact_number !== 'string') {                     // phone (if given) must be text
    return res.status(400).json({ error: 'Phone number must be text' });                  // send error
  }
  // phone (if given) must match the pattern
  if (contact_number && contact_number.trim() && !PHONE_PATTERN.test(contact_number.trim())) {
    return res.status(400).json({
      // send error
      error: 'Enter a valid phone number (digits, spaces, + - ( ) only, 7-20 characters)',
    });
  }
  if (gender != null && !['female', 'male'].includes(gender)) {                           // gender (if given) must be female or male
    return res.status(400).json({ error: 'Gender must be female or male' });              // send error
  }

  try {
    // update profile; COALESCE means gender can be set once but not changed later
    // (so nobody can change gender just to book a gender-specific slot)
    const result = await pool.query(
      `UPDATE users SET full_name = $1, contact_number = $2, gender = COALESCE(gender, $3)
       WHERE id = $4
       RETURNING id, full_name, email, role, student_staff_id, contact_number, organization, gender`,
      [full_name.trim(), contact_number?.trim() || null, gender || null, req.user.id],    // values for $1 to $4
    );
    // user not found
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json({ profile: result.rows[0] });                                                // send the updated profile
  } catch (err) {
    console.error(err);                                                                   // show the error in console
    res.status(500).json({ error: 'Failed to update profile' });                          // send error
  }
});

// ---------- PATCH /preferences : update notification settings ----------
router.patch('/preferences', authenticate, async (req, res) => {
  const preferenceFields = ['booking_updates', 'game_reminders', 'maintenance_alerts'];   // settings the user can change
  const entries = Object.entries(req.body);                                               // turn request body into [key, value] pairs
  if (
    entries.length === 0 ||                                                               // body must not be empty
    // every key must be allowed and every value true/false
    entries.some(([key, value]) => !preferenceFields.includes(key) || typeof value !== 'boolean')
  ) {
    return res
      .status(400)
      .json({ error: 'Provide one or more valid boolean notification preferences' });     // send error
  }

  try {
    // get current saved settings first, so changing one does not reset the others
    const currentResult = await pool.query(
      `SELECT booking_updates, game_reminders, maintenance_alerts
       FROM user_notification_preferences WHERE user_id = $1`,
      [req.user.id],                                                                      // value for $1
    );
    const preferences = {
      booking_updates: currentResult.rows[0]?.booking_updates ?? true,                    // old value, default true
      game_reminders: currentResult.rows[0]?.game_reminders ?? true,                      // old value, default true
      maintenance_alerts: currentResult.rows[0]?.maintenance_alerts ?? true,              // old value, default true
      ...req.body,                                                                        // new values from the request replace the old ones
    };
    // save settings (insert if new, update if the user already has a row)
    const result = await pool.query(
      `INSERT INTO user_notification_preferences
         (user_id, booking_updates, game_reminders, maintenance_alerts, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE SET
         booking_updates = EXCLUDED.booking_updates,
         game_reminders = EXCLUDED.game_reminders,
         maintenance_alerts = EXCLUDED.maintenance_alerts,
         updated_at = now()
       RETURNING booking_updates, game_reminders, maintenance_alerts`,
      [
        req.user.id,                                                                      // $1 user id
        preferences.booking_updates,                                                      // $2 booking updates
        preferences.game_reminders,                                                       // $3 game reminders
        preferences.maintenance_alerts,                                                   // $4 maintenance alerts
      ],
    );
    res.json({ preferences: result.rows[0] });                                            // send the saved settings
  } catch (err) {
    console.error(err);                                                                   // show the error in console
    res.status(500).json({ error: 'Failed to update notification preferences' });         // send error
  }
});

// ===================== 7. CHANGE EMAIL ROUTES (outsiders only) =====================

// ---------- POST /email-change : ask to change email ----------
// the link goes to the NEW email; the old email works until the link is opened
router.post('/email-change', authenticate, async (req, res) => {
  if (req.user.role !== 'outsider') {                                                     // only outsiders can change email
    return res.status(403).json({
      error:
        // send error
        'College email addresses cannot be changed here. Contact the DSA office through Help & Contact.',
    });
  }
  const { new_email, current_password } = req.body;                                       // get new email and current password
  const newEmail = typeof new_email === 'string' ? new_email.trim().toLowerCase() : '';   // clean new email if it is text
  if (!newEmail || newEmail.length > 150 || !OUTSIDER_EMAIL.test(newEmail)) {             // must be gmail, max 150 characters
    // send error
    return res.status(400).json({ error: 'Enter a valid Gmail address (ending @gmail.com).' });
  }
  if (newEmail === String(req.user.email).toLowerCase()) {                                // new email is same as old email
    return res.status(400).json({ error: 'That is already your email address.' });        // send error
  }
  if (typeof current_password !== 'string' || !current_password) {                        // password is compulsory
    // send error
    return res.status(400).json({ error: 'Enter your current password to change your email.' });
  }

  try {
    // get saved password hash
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    // user not found
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    const passwordHash = result.rows[0].password_hash;                                    // saved password hash
    const validPassword = passwordHash.startsWith('$2')                                   // is it a bcrypt hash?
      ? await bcrypt.compare(current_password, passwordHash)                              // yes: compare with bcrypt
      : current_password === passwordHash;                                                // no: old plain text, compare directly
    // wrong password
    if (!validPassword) return res.status(400).json({ error: 'Current password is incorrect' });

    // check if new email is already used
    const taken = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [newEmail]);
    if (taken.rows.length > 0)                                                            // already used
      // send error
      return res.status(409).json({ error: 'An account with this email already exists' });

    const token = await issueEmailChangeToken(req.user.id, newEmail, 24);                 // make a token valid for 24 hours
    // send the confirmation link to the NEW email
    await sendEmail({
      to: newEmail,                                                                       // send to the new email
      subject: 'Confirm your new CST-SFBS email address',                                 // email title
      // email message with link
      text: `Hello ${req.user.full_name},\n\nConfirm this address as your new CST-SFBS email within 24 hours:\n${actionUrl('/confirm-email-change', token)}\n\nIf you did not ask for this, ignore this message. Your email will not change.`,
    });
    res.json({
      // tell user to check new email
      message: `We sent a confirmation link to ${newEmail}. Your email changes once you open it.`,
      pending_email: newEmail,                                                            // the email waiting for confirmation
    });
  } catch (err) {
    console.error(err);                                                                   // show the error in console
    res
      .status(503)
      // send error
      .json({ error: 'Could not send the confirmation email. Please try again later.' });
  }
});

// ---------- POST /confirm-email-change : confirm the new email using the link ----------
// the link is opened from the NEW mailbox, so having the token is enough proof (no login needed)
router.post('/confirm-email-change', async (req, res) => {
  const { token } = req.body;                                                             // get the token
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {                      // token must be 64 hex characters
    return res.status(400).json({ error: 'Invalid or expired confirmation link' });       // send error
  }
  const client = await pool.connect();                                                    // get a connection for the transaction
  let oldEmail = null;                                                                    // old email, used later to send a warning
  let fullName = '';                                                                      // user's name, used later in the warning email
  let newEmail = null;                                                                    // new email
  try {
    await client.query('BEGIN');                                                          // start the transaction
    // mark the token as used (only if valid and not expired)
    const consumed = await client.query(
      `UPDATE auth_tokens SET consumed_at = now()
       WHERE token_hash = $1 AND purpose = 'email_change'
         AND consumed_at IS NULL AND expires_at > now()
       RETURNING user_id, new_email`,
      [hashToken(token)],                                                                 // value for $1
    );
    if (consumed.rows.length === 0) {                                                     // no valid token found
      // maybe the link was already used (opening it twice should not look like an error)
      const already = await client.query(
        `SELECT u.email FROM auth_tokens t JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = $1 AND t.purpose = 'email_change'
           AND t.consumed_at IS NOT NULL AND LOWER(u.email) = LOWER(t.new_email)`,
        [hashToken(token)],                                                               // value for $1
      );
      await client.query('ROLLBACK');                                                     // undo everything
      if (already.rows.length > 0) {                                                      // email was already updated
        return res.json({
          message: 'Your email address was already updated.',                             // friendly message
          email: already.rows[0].email,                                                   // the current email
        });
      }
      return res.status(400).json({ error: 'Invalid or expired confirmation link' });     // link is wrong or expired
    }

    const { user_id: userId } = consumed.rows[0];                                         // get the user id from the token
    newEmail = consumed.rows[0].new_email;                                                // get the new email from the token
    // get current user details (lock the row)
    const current = await client.query(
      'SELECT email, full_name, role FROM users WHERE id = $1 FOR UPDATE',
      [userId],                                                                           // value for $1
    );
    if (current.rows.length === 0 || current.rows[0].role !== 'outsider') {               // user must exist and be an outsider
      await client.query('ROLLBACK');                                                     // undo everything
      return res.status(400).json({ error: 'Invalid or expired confirmation link' });     // send error
    }
    oldEmail = current.rows[0].email;                                                     // keep the old email
    fullName = current.rows[0].full_name;                                                 // keep the name

    // change the email and mark it as verified
    await client.query('UPDATE users SET email = $1, email_verified = true WHERE id = $2', [
      newEmail,                                                                           // new email
      userId,                                                                             // user id
    ]);
    await client.query('COMMIT');                                                         // save everything permanently
  } catch (err) {
    await client.query('ROLLBACK');                                                       // undo changes if it failed
    if (err.code === '23505')                                                             // 23505 means the new email is already used
      // send error
      return res.status(409).json({ error: 'An account with this email already exists' });
    console.error(err);                                                                   // show the error in console
    return res.status(500).json({ error: 'Could not update your email address' });        // send error
  } finally {
    client.release();                                                                     // always give the connection back
  }

  // tell the OLD email about the change, so a hacker cannot change it secretly (not compulsory)
  sendEmail({
    to: oldEmail,                                                                         // send to the old email
    subject: 'Your CST-SFBS email address was changed',                                   // email title
    // warning message
    text: `Hello ${fullName},\n\nThe email on your CST-SFBS account was changed to ${newEmail}.\n\nIf this was not you, contact the DSA office right away.`,
  }).catch((emailError) =>
    console.error('Could not notify the old email address:', emailError.message),         // if it fails, just log it
  );

  res.json({ message: 'Your email address has been updated.', email: newEmail });         // tell user the email is updated
});

// ===================== 8. DELETE ACCOUNT =====================

// ---------- DELETE /account : delete (anonymize) the account ----------
router.delete('/account', authenticate, async (req, res) => {
  if (req.user.role === 'admin') {                                                        // admin cannot be deleted here
    return res
      .status(403)
      .json({ error: 'Admin accounts cannot be deleted from profile settings' });         // send error
  }

  const { current_password } = req.body;                                                  // get the password from the request
  if (typeof current_password !== 'string' || !current_password) {                        // password is compulsory
    return res
      .status(400)
      .json({ error: 'Your current password is required to delete your account' });       // send error
  }

  let client;                                                                             // database connection for the transaction
  let transactionStarted = false;                                                         // remember if BEGIN was run, so we know when to ROLLBACK
  try {
    client = await pool.connect();                                                        // get one connection from the pool
    await client.query('BEGIN');                                                          // start the transaction
    transactionStarted = true;                                                            // remember that it started

    // get saved password hash (lock the row)
    const result = await client.query('SELECT password_hash FROM users WHERE id = $1 FOR UPDATE', [
      req.user.id,                                                                        // value for $1
    ]);
    if (result.rows.length === 0) {                                                       // user not found
      await client.query('ROLLBACK');                                                     // undo everything
      transactionStarted = false;                                                         // transaction is finished
      return res.status(404).json({ error: 'Account not found' });                        // send error
    }

    const passwordHash = result.rows[0].password_hash;                                    // saved password hash
    const passwordMatches = passwordHash.startsWith('$2')                                 // is it a bcrypt hash?
      ? await bcrypt.compare(current_password, passwordHash)                              // yes: compare with bcrypt
      : current_password === passwordHash;                                                // no: old plain text, compare directly
    if (!passwordMatches) {                                                               // wrong password
      await client.query('ROLLBACK');                                                     // undo everything
      transactionStarted = false;                                                         // transaction is finished
      return res.status(400).json({ error: 'Current password is incorrect' });            // send error
    }

    // fake unique email for the deleted account
    const deletedEmail = `deleted-${req.user.id}-${crypto.randomBytes(8).toString('hex')}@account.invalid`;
    // random password hash nobody can use to login
    const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    // delete the user's notification settings
    await client.query('DELETE FROM user_notification_preferences WHERE user_id = $1', [
      req.user.id,                                                                        // value for $1
    ]);
    await client.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);    // delete the user's notifications
    await client.query('DELETE FROM auth_tokens WHERE user_id = $1', [req.user.id]);      // delete the user's tokens
    // delete reminders of the user's bookings
    await client.query(
      `DELETE FROM booking_reminders
       WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = $1)`,
      [req.user.id],                                                                      // value for $1
    );
    // cancel future active bookings and remove the booking purpose text
    await client.query(
      `UPDATE bookings
       SET status = CASE
         WHEN booking_date >= (now() AT TIME ZONE 'Asia/Thimphu')::date
           AND status NOT IN ('cancelled', 'expired') THEN 'cancelled'
         ELSE status
       END,
       purpose = NULL
       WHERE user_id = $1`,
      [req.user.id],                                                                      // value for $1
    );
    // remove personal details from the user's support requests
    await client.query(
      `UPDATE support_requests
       SET user_id = NULL, name = 'Deleted account', email = $2,
           message = 'Content removed at account deletion request.'
       WHERE user_id = $1`,
      [req.user.id, deletedEmail],                                                        // values for $1 and $2
    );
    // anonymize the user row (keep the row, remove all personal details)
    await client.query(
      `UPDATE users
       SET full_name = 'Deleted account', email = $2, student_staff_id = NULL,
           password_hash = $3, contact_number = NULL, organization = NULL,
           gender = NULL, email_verified = false, is_active = false
       WHERE id = $1`,
      [req.user.id, deletedEmail, unusablePasswordHash],                                  // values for $1 to $3
    );

    await client.query('COMMIT');                                                         // save everything permanently
    transactionStarted = false;                                                           // transaction is finished
    // success
    res.json({ message: 'Your account has been deleted and your personal details anonymized.' });
  } catch (error) {
    if (client && transactionStarted) await client.query('ROLLBACK');                     // undo changes if it failed
    console.error(error);                                                                 // show the error in console
    res.status(500).json({ error: 'Could not delete your account' });                     // send error
  } finally {
    client?.release();                                                                    // always give the connection back
  }
});

// ===================== 9. EXPORT =====================
module.exports = router;                                                                  // export the router so the main app can use these routes
