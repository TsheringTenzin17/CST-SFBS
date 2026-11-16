const bcrypt = require('bcryptjs');
const { isBcryptHash } = require('../passwords');

async function migrateLegacyUserPasswords(pool) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const result = await client.query('SELECT id, password_hash FROM users ORDER BY id FOR UPDATE');
    let migrated = 0;

    for (const user of result.rows) {
      if (typeof user.password_hash !== 'string') {
        throw new Error('A user has no usable password value.');
      }
      if (isBcryptHash(user.password_hash)) continue;

      const passwordHash = await bcrypt.hash(user.password_hash, 10);
      if (!isBcryptHash(passwordHash)) {
        throw new Error('bcrypt returned an invalid password hash.');
      }

      const update = await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        passwordHash,
        user.id,
      ]);
      if (update.rowCount !== 1) {
        throw new Error('A user password could not be updated.');
      }
      migrated += 1;
    }

    const verification = await client.query('SELECT password_hash FROM users');
    if (verification.rows.some((user) => !isBcryptHash(user.password_hash))) {
      throw new Error('One or more user passwords are not valid bcrypt hashes.');
    }

    await client.query('COMMIT');
    transactionStarted = false;
    return { scanned: verification.rows.length, migrated };
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  require('dotenv').config();
  const pool = require('../db');

  try {
    const { scanned, migrated } = await migrateLegacyUserPasswords(pool);
    console.log(`Migrated ${migrated} legacy password(s); verified ${scanned} user account(s).`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Password hash migration failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { migrateLegacyUserPasswords };
