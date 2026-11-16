const bcrypt = require('bcryptjs');

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isBcryptHash(value) {
  return typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);
}

async function verifyPassword(password, passwordHash) {
  if (!isBcryptHash(passwordHash)) return false;
  return bcrypt.compare(password, passwordHash);
}

module.exports = { isBcryptHash, verifyPassword };
