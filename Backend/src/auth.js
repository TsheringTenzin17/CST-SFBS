const crypto = require('crypto');
const pool = require('./db');

// Shared session helpers used by routes to authenticate requests and restrict admin actions.
// Set SESSION_SECRET in the environment so existing tokens remain valid across server restarts.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_DURATION_SECONDS = 12 * 60 * 60;

// Base64url-encode the token payload; the HMAC below provides integrity, not encryption.
function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createSessionToken(userId) {
  // The token contains the user ID and expiration time, followed by a server-generated signature.
  const payload = encode({
    sub: Number(userId),
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  });
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function authenticate(req, res, next) {
  // Protected requests must include the token in the Authorization header.
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer ([\w-]+\.[\w-]+)$/);
  if (!match) return res.status(401).json({ error: 'Authentication required' });

  const [payload, signature] = match[1].split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  // Compare signatures in constant time to avoid leaking comparison details.
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  let session;
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  if (!Number.isInteger(session.sub) || session.sub <= 0 || session.exp <= Date.now() / 1000) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // Load the current user record so deleted accounts and updated roles take effect immediately.
  pool.query(
    `SELECT id, full_name, email, role, student_staff_id, contact_number, organization, gender
       FROM users WHERE id = $1`,
    [session.sub],
  )
    .then((result) => {
      if (result.rows.length === 0) return res.status(401).json({ error: 'Account no longer exists' });
      req.user = result.rows[0];
      next();
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: 'Could not verify session' });
    });
}

function requireAdmin(req, res, next) {
  // Authenticate first, then allow the request only if the current account has the admin role.
  authenticate(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    next();
  });
}

module.exports = { authenticate, createSessionToken, requireAdmin };
