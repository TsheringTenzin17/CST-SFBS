const bcrypt = require('bcryptjs');
const { isBcryptHash, verifyPassword } = require('../passwords');
const { migrateLegacyUserPasswords } = require('../db/migrate-legacy-passwords');

function makePool(users) {
  let snapshot;
  const client = {
    query: jest.fn(async (sql, values = []) => {
      if (sql === 'BEGIN') {
        snapshot = users.map((user) => ({ ...user }));
        return {};
      }
      if (sql === 'COMMIT') {
        snapshot = undefined;
        return {};
      }
      if (sql === 'ROLLBACK') {
        users.splice(0, users.length, ...snapshot.map((user) => ({ ...user })));
        snapshot = undefined;
        return {};
      }
      if (sql === 'SELECT id, password_hash FROM users ORDER BY id FOR UPDATE') {
        return { rows: users.map((user) => ({ ...user })) };
      }
      if (sql === 'SELECT password_hash FROM users') {
        return { rows: users.map(({ password_hash }) => ({ password_hash })) };
      }
      if (sql === 'UPDATE users SET password_hash = $1 WHERE id = $2') {
        const user = users.find(({ id }) => id === values[1]);
        if (!user) return { rowCount: 0 };
        user.password_hash = values[0];
        return { rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    }),
    release: jest.fn(),
  };

  return { connect: jest.fn().mockResolvedValue(client), client };
}

describe('legacy password migration', () => {
  test('hashes plaintext values, preserves bcrypt hashes, and is idempotent', async () => {
    const existingHash = await bcrypt.hash('already protected', 10);
    const users = [
      { id: 1, password_hash: 'legacy password' },
      { id: 2, password_hash: existingHash },
      { id: 3, password_hash: '$2-not-a-bcrypt-hash' },
    ];
    const pool = makePool(users);

    const result = await migrateLegacyUserPasswords(pool);

    expect(result).toEqual({ scanned: 3, migrated: 2 });
    expect(users.every(({ password_hash }) => isBcryptHash(password_hash))).toBe(true);
    await expect(bcrypt.compare('legacy password', users[0].password_hash)).resolves.toBe(true);
    await expect(bcrypt.compare('$2-not-a-bcrypt-hash', users[2].password_hash)).resolves.toBe(
      true,
    );
    expect(users[1].password_hash).toBe(existingHash);

    const secondRun = await migrateLegacyUserPasswords(pool);
    expect(secondRun).toEqual({ scanned: 3, migrated: 0 });
  });

  test('rejects plaintext verification and rolls back if a user row is invalid', async () => {
    const hash = await bcrypt.hash('correct password', 10);
    await expect(verifyPassword('correct password', hash)).resolves.toBe(true);
    await expect(verifyPassword('legacy password', 'legacy password')).resolves.toBe(false);

    const users = [
      { id: 1, password_hash: 'legacy password' },
      { id: 2, password_hash: null },
    ];
    const pool = makePool(users);

    await expect(migrateLegacyUserPasswords(pool)).rejects.toThrow(
      'A user has no usable password value.',
    );
    expect(users[0].password_hash).toBe('legacy password');
    expect(pool.client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(pool.client.release).toHaveBeenCalled();
  });
});
