// ==============================================================
// IMPORTS - load the packages and helper files we need
// ==============================================================
const crypto = require('crypto');                           // built in tools for signing
const pool = require('./db');                               // database connection pool

// ==============================================================
// SETTINGS - secret key and how long a login lasts
// ==============================================================
// Shared session helpers used by routes to authenticate requests and restrict admin actions.
// Set SESSION_SECRET in the environment so existing tokens remain valid across server restarts.
// use the secret from .env, or make a random one if missing
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_DURATION_SECONDS = 12 * 60 * 60;              // login lasts 12 hours

// ==============================================================
// encode - turn an object into a safe text for the token
// ==============================================================
// Base64url-encode the token payload; the HMAC below provides integrity, not encryption.
function encode(value) {                                    // takes any object
  // object to json text, then to base64url text
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}                                                           // end of function

// ==============================================================
// createSessionToken - make a signed login token for a user
// ==============================================================
function createSessionToken(userId) {                       // takes the user id
  // ----------------------------------------------------------
  // build the payload
  // ----------------------------------------------------------
  // The token contains the user ID and expiration time, followed by a server-generated signature.
  const payload = encode({                                  // put user and expiry in the token
    sub: Number(userId),                                    // sub is the user id
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,  // expiry time in seconds
  });                                                       // end of payload

  // ----------------------------------------------------------
  // sign the payload
  // ----------------------------------------------------------
  // make a signature with the secret so nobody can fake the token
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;                         // token is payload dot signature
}                                                           // end of function

// ==============================================================
// authenticate - check the token and load the user
// ==============================================================
function authenticate(req, res, next) {                     // middleware for protected routes
  // ----------------------------------------------------------
  // read the token from the header
  // ----------------------------------------------------------
  // Protected requests must include the token in the Authorization header.
  const authorization = req.get('authorization') || '';     // header text or empty text
  // header must look like: Bearer payload.signature
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  // no good token so stop here
  if (!match) return res.status(401).json({ error: 'Authentication required' });

  // ----------------------------------------------------------
  // check the signature
  // ----------------------------------------------------------
  const [payload, signature] = match[1].split('.');         // split token into two parts
  // make the signature we expect using our secret
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest();
  let actual;                                               // will hold the signature from the user
  try {                                                     // catch bad base64 text
    actual = Buffer.from(signature, 'base64url');           // turn signature text into bytes
  } catch {                                                 // signature was not valid
    // stop here and tell the session is bad
    return res.status(401).json({ error: 'Invalid or expired session' });
  }                                                         // end of catch
  // Compare signatures in constant time to avoid leaking comparison details.
  // lengths must match and the bytes must match
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    // stop here and tell the session is bad
    return res.status(401).json({ error: 'Invalid or expired session' });
  }                                                         // end of if

  // ----------------------------------------------------------
  // read the payload and check it
  // ----------------------------------------------------------
  let session;                                              // will hold the token data
  try {                                                     // catch bad json
    // base64url text back to text, then to an object
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {                                                 // payload was not valid
    // stop here and tell the session is bad
    return res.status(401).json({ error: 'Invalid or expired session' });
  }                                                         // end of catch
  // user id must be a good number and the token must not be expired
  if (!Number.isInteger(session.sub) || session.sub <= 0 || session.exp <= Date.now() / 1000) {
    // stop here and tell the session is bad
    return res.status(401).json({ error: 'Invalid or expired session' });
  }                                                         // end of if

  // ----------------------------------------------------------
  // load the user from the database
  // ----------------------------------------------------------
  // Load the current user record so deleted accounts and updated roles take effect immediately.
  // select the user details for this token
  pool                                                      // use the database pool
    .query(                                                 // run the select
      `SELECT id, full_name, email, role, student_staff_id, contact_number, organization, gender, is_active
       FROM users WHERE id = $1`,
      [session.sub],                                        // $1 is the user id from the token
    )                                                       // end of query
    .then((result) => {                                     // when the query finishes
      if (result.rows.length === 0)                         // no user with this id
        // tell the account is gone
        return res.status(401).json({ error: 'Account no longer exists' });
      if (result.rows[0].is_active === false) {             // account is suspended
        return res                                          // stop here and reply
          .status(403)                                      // forbidden code
          // tell the user to contact the office
          .json({ error: 'This account has been suspended. Please contact the DSA office.' });
      }                                                     // end of if
      req.user = result.rows[0];                            // save the user for the next steps
      next();                                               // go to the next function
    })                                                      // end of then
    .catch((error) => {                                     // something went wrong
      console.error(error);                                 // show error in terminal
      // send 500 with a simple message
      res.status(500).json({ error: 'Could not verify session' });
    });                                                     // end of catch
}                                                           // end of function

// ==============================================================
// requireAdmin - only let admins through
// ==============================================================
function requireAdmin(req, res, next) {                     // middleware for admin routes
  // Authenticate first, then allow the request only if the current account has the admin role.
  authenticate(req, res, () => {                            // check login first
    // not an admin so stop here
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    next();                                                 // is an admin so continue
  });                                                       // end of authenticate
}                                                           // end of function

// ==============================================================
// EXPORT - let other files use these functions
// ==============================================================
module.exports = { authenticate, createSessionToken, requireAdmin };  // share the functions
