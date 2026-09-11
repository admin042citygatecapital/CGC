import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  isDatabaseConfigured: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: dependencies.isDatabaseConfigured,
  getDb: dependencies.getDb,
}));

import {
  consumeResetToken,
  issueResetToken,
  validateResetToken,
} from '../../server/lib/adminResetTokenStore.js';

function failingDb(): Record<string, unknown> {
  return {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => Promise.reject(new Error('db unavailable')),
      }),
    }),
    // Drizzle's builder is chainable: delete(...).where(...) must be awaited
    // through where(), or the rejection is created but never observed.
    delete: () => ({
      where: () => Promise.reject(new Error('db unavailable')),
    }),
    select: () => {
      throw new Error('db unavailable');
    },
    from: () => ({}),
    where: () => Promise.resolve([]),
  };
}

describe('admin reset token store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('rejects expired tokens in the in-memory fallback too', async () => {
    dependencies.isDatabaseConfigured.mockReturnValue(false);

    const raw = await issueResetToken();
    expect(raw).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(await validateResetToken(raw!)).toBe(true);

    // 45-minute expiry must also apply without a database.
    vi.setSystemTime(new Date('2026-01-01T00:46:00Z'));
    expect(await validateResetToken(raw!)).toBe(false);
  });

  it('returns null from issueResetToken when persistence fails — no dead links', async () => {
    dependencies.isDatabaseConfigured.mockReturnValue(true);
    dependencies.getDb.mockReturnValue(failingDb());

    const raw = await issueResetToken();
    expect(raw).toBeNull();
    expect(await validateResetToken('a'.repeat(64))).toBe(false);
  });

  it('reports consumeResetToken failure instead of assuming the token is spent', async () => {
    dependencies.isDatabaseConfigured.mockReturnValue(true);
    dependencies.getDb.mockReturnValue(failingDb());

    expect(await consumeResetToken()).toBe(false);
  });

  it('rejects stored entries that are not a well-formed token record', async () => {
    dependencies.isDatabaseConfigured.mockReturnValue(true);
    dependencies.getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([
            { key: 'admin_reset_token', value: { hash: 'not-a-hash', expiresAt: new Date(Date.now() + 60_000).toISOString() } },
          ]),
        }),
      }),
    });

    expect(await validateResetToken('b'.repeat(64))).toBe(false);
  });

  it('validates and consumes tokens through the database path', async () => {
    dependencies.isDatabaseConfigured.mockReturnValue(true);
    const realCrypto = await import('node:crypto');
    const raw = 'c'.repeat(64);
    const hash = realCrypto.createHash('sha256').update(raw).digest('hex');

    dependencies.getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([
            { key: 'admin_reset_token', value: { hash, expiresAt: new Date(Date.now() + 60_000).toISOString() } },
          ]),
        }),
      }),
      delete: () => ({ where: () => Promise.resolve() }),
    });

    expect(await validateResetToken(raw)).toBe(true);
    expect(await validateResetToken('d'.repeat(64))).toBe(false);
    expect(await consumeResetToken()).toBe(true);
  });
});