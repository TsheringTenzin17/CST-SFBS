const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');
const { authenticate, createSessionToken } = require('../auth');
const { sendEmail } = require('../email');
const router = express.Router();

const COLLEGE_EMAIL = /^[^@\s]+\.cst@rub\.edu\.bt$/i;
const OUTSIDER_EMAIL = /^[^@\s]+@gmail\.com$/i;
const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/; // e.g. 77682600 or +975 77682600
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueToken(userId, purpose, expiresInHours) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, purpose]
  );
  await pool.query(
    `INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
     VALUES ($1, $2, $3, now() + ($4 * interval '1 hour'))`,
    [hashToken(token), userId, purpose, expiresInHours]
  );
  return token;
}

// Email-change links remember WHICH address they confirm (auth_tokens.new_email).
async function issueEmailChangeToken(userId, newEmail, expiresInHours) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = 'email_change' AND consumed_at IS NULL`,
    [userId]
  );
  await pool.query(
    `INSERT INTO auth_tokens (token_hash, user_id, purpose, new_email, expires_at)
     VALUES ($1, $2, 'email_change', $3, now() + ($4 * interval '1 hour'))`,
    [hashToken(token), userId, newEmail, expiresInHours]
  );
  return token;
}

function actionUrl(path, token) {
  const url = new URL(path, `${FRONTEND_URL}/`);
  url.searchParams.set('token', token);
  return url.toString();
}

// 02210145.cst@rub.edu.bt -> student ; kwangdi.cst@rub.edu.bt -> faculty (staff)
function roleFromCollegeEmail(email) {
  const local = email.split('.cst@')[0];
  return /^\d+$/.test(local) ? 'student' : 'faculty';
}

router.post('/register', async (req, res) => {
  const { full_name, password, contact_number, organization, role: requestedRole, gender } = req.body;  
  const email = (req.body.email || '').trim().toLowerCase();
  

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email and password are required' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  if (!['female', 'male'].includes(gender)) {
     return res.status(400).json({ error: 'Select your gender (female or male).' });
   }

  // Role (and the student ID) always come from the email, never from the request.
  // Public registration cannot create admins.
  let role;
  let student_staff_id = null; // staff and outsiders have no ID
  if (COLLEGE_EMAIL.test(email)) {
    if (requestedRole === 'outsider') {
      return res.status(400).json({ error: 'College emails must register as Student or Staff' });
    }
    role = roleFromCollegeEmail(email);
    if (requestedRole && requestedRole !== role) {
      return res.status(400).json({
        error: role === 'student'
          ? 'This is a student email. Pick the Student option.'
          : 'This is a staff email. Pick the Staff option.',
      });
    }
    if (role === 'student') student_staff_id = email.split('.cst@')[0];
  } else {
    if (requestedRole === 'student' || requestedRole === 'faculty') {
      return res.status(400).json({ error: 'Student and staff accounts need a college email ending .cst@rub.edu.bt' });
    }
    if (!OUTSIDER_EMAIL.test(email)) {
      return res.status(400).json({ error: 'Use your college email (.cst@rub.edu.bt) or a Gmail address (@gmail.com) to register.' });
    }
    role = 'outsider';
  }

  // Outsiders must give an organization name (or a team name). Students and staff do not.
  const organizationName = role === 'outsider' ? String(organization || '').trim() : null;
  if (role === 'outsider' && !organizationName) {
    return res.status(400).json({ error: 'Enter your organization name, or your team name if you are not with an organization.' });
  }
  if (organizationName && organizationName.length > 120) {
    return res.status(400).json({ error: 'Organization or team name must be 120 characters or fewer' });
  }

  try {
    if (student_staff_id) {
      const taken = await pool.query('SELECT 1 FROM users WHERE student_staff_id = $1', [student_staff_id]);
      if (taken.rows.length > 0) return res.status(409).json({ error: 'An account with this Student / Staff ID already exists' });
    }
    // Store only a bcrypt hash for newly registered accounts.
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, student_staff_id, role, password_hash, contact_number, organization, gender, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING id, full_name, email, role`,
      [full_name.trim(), email, student_staff_id || null, role, passwordHash, contact_number || null, organizationName, gender]
    );
    const user = result.rows[0];
    const token = await issueToken(user.id, 'email_verification', 24);
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verify your CST-SFBS account',
        text: `Hello ${user.full_name},\n\nVerify your email address within 24 hours:\n${actionUrl('/verify-email', token)}\n\nIf you did not create this account, you can ignore this message.`,
      });
      res.status(201).json({ user, verification_email_sent: true });
    } catch (emailError) {
      console.error(emailError);
      res.status(503).json({
        error: 'Your account was created, but the verification email could not be sent. Configure the email service and request another verification email.',
        account_created: true,
        user,
      });
    }
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// The "email" field may contain an email OR a Student / Staff ID.
router.post('/login', async (req, res) => {
  const identifier = (req.body.email || req.body.identifier || '').trim();
  const { password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'email (or ID) and password are required' });

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, password_hash, email_verified,
              student_staff_id, contact_number, organization, gender, is_active FROM users
       WHERE LOWER(email) = LOWER($1) OR student_staff_id = $1 LIMIT 1`,
      [identifier]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email/ID or password' });

    const row = result.rows[0];
    let ok;
    if (row.password_hash.startsWith('$2')) {
      ok = await bcrypt.compare(password, row.password_hash);
    } else {
      // Upgrade a legacy plain-text password after successful verification.
      ok = row.password_hash === password; // old plain-text account
      if (ok) {
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(password, 10), row.id]);
      }
    }
    if (!ok) return res.status(401).json({ error: 'Invalid email/ID or password' });
    if (!row.email_verified) {
      return res.status(403).json({
        error: 'Verify your email before signing in. You can request another verification email from the registration page.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    if (row.is_active === false) {
      return res.status(403).json({ error: 'This account has been suspended. Please contact the DSA office.' });
    }

    const { password_hash, email_verified, is_active, ...user } = row;
    // Never return the stored password hash; issue a session token for subsequent requests.
    res.json({ user, token: createSessionToken(user.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/resend-verification', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await pool.query(
      'SELECT id, full_name, email FROM users WHERE LOWER(email) = $1 AND email_verified = false',
      [email]
    );
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const token = await issueToken(user.id, 'email_verification', 24);
      await sendEmail({
        to: user.email,
        subject: 'Verify your CST-SFBS account',
        text: `Hello ${user.full_name},\n\nVerify your email address within 24 hours:\n${actionUrl('/verify-email', token)}\n\nIf you did not create this account, you can ignore this message.`,
      });
    }
    res.json({ message: 'If an unverified account exists for that email, a verification link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: 'Could not send the verification email. Please try again later.' });
  }
});

router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ error: 'Invalid or expired verification link' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE auth_tokens SET consumed_at = now()
       WHERE token_hash = $1 AND purpose = 'email_verification'
         AND consumed_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [hashToken(token)]
    );
    if (result.rows.length === 0) {
      const alreadyVerified = await client.query(
        `SELECT 1 FROM auth_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = $1 AND t.purpose = 'email_verification'
           AND t.consumed_at IS NOT NULL AND u.email_verified = true`,
        [hashToken(token)]
      );
      if (alreadyVerified.rows.length > 0) {
        await client.query('COMMIT');
        return res.json({ message: 'Email is already verified. You can sign in.' });
      }
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }
    await client.query('UPDATE users SET email_verified = true WHERE id = $1', [result.rows[0].user_id]);
    await client.query('COMMIT');
    res.json({ message: 'Email verified. You can now sign in.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not verify email' });
  } finally {
    client.release();
  }
});

router.post('/forgot-password', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await pool.query(
      'SELECT id, full_name, email FROM users WHERE LOWER(email) = $1 AND email_verified = true',
      [email]
    );
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const token = await issueToken(user.id, 'password_reset', 1);
      const resetUrl = actionUrl('/reset-password', token);
            const emailConfigured =
        (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) ||
        (process.env.RESEND_API_KEY && process.env.RESEND_FROM);
      if (!emailConfigured) {
        if (process.env.NODE_ENV !== 'production') {
          return res.json({
            message: 'Email delivery is not configured. Use this local development reset link (valid for one hour).',
            reset_url: resetUrl,
          });
        }
        throw new Error('Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
      }
      await sendEmail({
        to: user.email,
        subject: 'Reset your CST-SFBS password',
        text: `Hello ${user.full_name},\n\nReset your password within one hour:\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`,
      });
    }
    res.json({ message: 'If a verified account exists for that email, password reset instructions have been sent.' });
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: 'Could not send password reset instructions. Please try again later.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ error: 'Invalid or expired password reset link' });
  }
  if (typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash(new_password, 10);
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE auth_tokens SET consumed_at = now()
       WHERE token_hash = $1 AND purpose = 'password_reset'
         AND consumed_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [hashToken(token)]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired password reset link' });
    }
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, result.rows[0].user_id]);
    await client.query('COMMIT');
    res.json({ message: 'Password reset successfully. Sign in with your new password.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not reset password' });
  } finally {
    client.release();
  }
});

router.get('/me', authenticate, (req, res) => {
  // authenticate attaches the current user's public profile to the request.
  res.json({ user: req.user });
});

router.get('/profile', authenticate, async (req, res) => {
  try {
    const [profile, preferences] = await Promise.all([
      pool.query(
        `SELECT id, full_name, email, role, student_staff_id, contact_number,
                organization, gender, to_char(created_at, 'YYYY-MM-DD') AS joined
         FROM users WHERE id = $1`,
        [req.user.id]
      ),
      pool.query(
        `SELECT booking_updates, game_reminders, maintenance_alerts
         FROM user_notification_preferences WHERE user_id = $1`,
        [req.user.id]
      ),
    ]);
    if (profile.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    // An unconfirmed email change, if any. Never let this lookup break the profile page
    // (for example if the email-change migration has not been run yet).
    let pendingEmail = null;
    try {
      const pending = await pool.query(
        `SELECT new_email FROM auth_tokens
         WHERE user_id = $1 AND purpose = 'email_change'
           AND consumed_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [req.user.id]
      );
      pendingEmail = pending.rows[0]?.new_email || null;
    } catch (pendingError) {
      console.error('Could not look up pending email change:', pendingError.message);
    }
    res.json({
      profile: { ...profile.rows[0], pending_email: pendingEmail },
      preferences: preferences.rows[0] || {
        booking_updates: true,
        game_reminders: true,
        maintenance_alerts: true,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile settings' });
  }
});

router.patch('/profile', authenticate, async (req, res) => {
  const { full_name, contact_number, gender } = req.body;
  if (typeof full_name !== 'string' || !full_name.trim() || full_name.trim().length > 120) {
    return res.status(400).json({ error: 'Name is required and must be 120 characters or fewer' });
  }
  if (contact_number != null && typeof contact_number !== 'string') {
    return res.status(400).json({ error: 'Phone number must be text' });
  }
  if (contact_number && contact_number.trim() && !PHONE_PATTERN.test(contact_number.trim())) {
    return res.status(400).json({ error: 'Enter a valid phone number (digits, spaces, + - ( ) only, 7-20 characters)' });
  }
  if (gender != null && !['female', 'male'].includes(gender)) {
    return res.status(400).json({ error: 'Gender must be female or male' });
  }

  try {
    // gender = COALESCE(gender, $3): it can be set once, but not changed afterwards,
    // so nobody can switch gender just to book a gender-specific slot.
    const result = await pool.query(
      `UPDATE users SET full_name = $1, contact_number = $2, gender = COALESCE(gender, $3)
       WHERE id = $4
       RETURNING id, full_name, email, role, student_staff_id, contact_number, organization, gender`,
      [full_name.trim(), contact_number?.trim() || null, gender || null, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ---- Change email (outsiders only) ---------------------------------------
// Student and staff emails (.cst@rub.edu.bt) decide the account's role and ID,
// so they cannot be changed here. Outsiders confirm the NEW address by link;
// the old address keeps working until that link is opened.
router.post('/email-change', authenticate, async (req, res) => {
  if (req.user.role !== 'outsider') {
    return res.status(403).json({
      error: 'College email addresses cannot be changed here. Contact the DSA office through Help & Contact.',
    });
  }
  const { new_email, current_password } = req.body;
  const newEmail = typeof new_email === 'string' ? new_email.trim().toLowerCase() : '';
  if (!newEmail || newEmail.length > 150 || !OUTSIDER_EMAIL.test(newEmail)) {
    return res.status(400).json({ error: 'Enter a valid Gmail address (ending @gmail.com).' });
  }
  if (newEmail === String(req.user.email).toLowerCase()) {
    return res.status(400).json({ error: 'That is already your email address.' });
  }
  if (typeof current_password !== 'string' || !current_password) {
    return res.status(400).json({ error: 'Enter your current password to change your email.' });
  }

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    const passwordHash = result.rows[0].password_hash;
    const validPassword = passwordHash.startsWith('$2')
      ? await bcrypt.compare(current_password, passwordHash)
      : current_password === passwordHash;
    if (!validPassword) return res.status(400).json({ error: 'Current password is incorrect' });

    const taken = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [newEmail]);
    if (taken.rows.length > 0) return res.status(409).json({ error: 'An account with this email already exists' });

    const token = await issueEmailChangeToken(req.user.id, newEmail, 24);
    await sendEmail({
      to: newEmail,
      subject: 'Confirm your new CST-SFBS email address',
      text: `Hello ${req.user.full_name},\n\nConfirm this address as your new CST-SFBS email within 24 hours:\n${actionUrl('/confirm-email-change', token)}\n\nIf you did not ask for this, ignore this message. Your email will not change.`,
    });
    res.json({ message: `We sent a confirmation link to ${newEmail}. Your email changes once you open it.`, pending_email: newEmail });
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: 'Could not send the confirmation email. Please try again later.' });
  }
});

// The link is opened from the NEW mailbox, so possession of the token is the proof (no login needed).
router.post('/confirm-email-change', async (req, res) => {
  const { token } = req.body;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ error: 'Invalid or expired confirmation link' });
  }
  const client = await pool.connect();
  let oldEmail = null;
  let fullName = '';
  let newEmail = null;
  try {
    await client.query('BEGIN');
    const consumed = await client.query(
      `UPDATE auth_tokens SET consumed_at = now()
       WHERE token_hash = $1 AND purpose = 'email_change'
         AND consumed_at IS NULL AND expires_at > now()
       RETURNING user_id, new_email`,
      [hashToken(token)]
    );
    if (consumed.rows.length === 0) {
      // Opening the same link twice should not look like a failure.
      const already = await client.query(
        `SELECT u.email FROM auth_tokens t JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = $1 AND t.purpose = 'email_change'
           AND t.consumed_at IS NOT NULL AND LOWER(u.email) = LOWER(t.new_email)`,
        [hashToken(token)]
      );
      await client.query('ROLLBACK');
      if (already.rows.length > 0) {
        return res.json({ message: 'Your email address was already updated.', email: already.rows[0].email });
      }
      return res.status(400).json({ error: 'Invalid or expired confirmation link' });
    }

    const { user_id: userId } = consumed.rows[0];
    newEmail = consumed.rows[0].new_email;
    const current = await client.query('SELECT email, full_name, role FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (current.rows.length === 0 || current.rows[0].role !== 'outsider') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired confirmation link' });
    }
    oldEmail = current.rows[0].email;
    fullName = current.rows[0].full_name;

    await client.query('UPDATE users SET email = $1, email_verified = true WHERE id = $2', [newEmail, userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    console.error(err);
    return res.status(500).json({ error: 'Could not update your email address' });
  } finally {
    client.release();
  }

  // Tell the OLD address so a hijacked account cannot silently change email. Best effort only.
  sendEmail({
    to: oldEmail,
    subject: 'Your CST-SFBS email address was changed',
    text: `Hello ${fullName},\n\nThe email on your CST-SFBS account was changed to ${newEmail}.\n\nIf this was not you, contact the DSA office right away.`,
  }).catch((emailError) => console.error('Could not notify the old email address:', emailError.message));

  res.json({ message: 'Your email address has been updated.', email: newEmail });
});

router.patch('/password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (typeof current_password !== 'string' || !current_password || typeof new_password !== 'string') {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });

    const passwordHash = result.rows[0].password_hash;
    const validCurrentPassword = passwordHash.startsWith('$2')
      ? await bcrypt.compare(current_password, passwordHash)
      : current_password === passwordHash;
    if (!validCurrentPassword) return res.status(400).json({ error: 'Current password is incorrect' });

    const newPasswordHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

router.patch('/preferences', authenticate, async (req, res) => {
  const preferenceFields = ['booking_updates', 'game_reminders', 'maintenance_alerts'];
  const entries = Object.entries(req.body);
  if (entries.length === 0 || entries.some(([key, value]) => !preferenceFields.includes(key) || typeof value !== 'boolean')) {
    return res.status(400).json({ error: 'Provide one or more valid boolean notification preferences' });
  }

  try {
    // Load defaults first so updating one switch preserves the other saved preferences.
    const currentResult = await pool.query(
      `SELECT booking_updates, game_reminders, maintenance_alerts
       FROM user_notification_preferences WHERE user_id = $1`,
      [req.user.id]
    );
    const preferences = {
      booking_updates: currentResult.rows[0]?.booking_updates ?? true,
      game_reminders: currentResult.rows[0]?.game_reminders ?? true,
      maintenance_alerts: currentResult.rows[0]?.maintenance_alerts ?? true,
      ...req.body,
    };
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
      [req.user.id, preferences.booking_updates, preferences.game_reminders, preferences.maintenance_alerts]
    );
    res.json({ preferences: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

module.exports = router;