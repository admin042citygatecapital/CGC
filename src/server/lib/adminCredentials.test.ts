import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './adminCredentials.js';

describe('administrator password compatibility', () => {
  it('creates and verifies the current Argon2id format', async () => {
    const password = 'Test-Admin-Password-2026!';
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword(`${password}x`, hash)).resolves.toBe(false);
  });

  it('verifies legacy bcrypt hashes during migration', async () => {
    const password = 'Legacy-Admin-Password-2026!';
    const hash = await bcrypt.hash(password, 4);

    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});
