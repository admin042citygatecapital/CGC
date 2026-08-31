import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  rawValues: [] as unknown[][],
  rows: [] as Array<Record<string, unknown>>,
  selectCalls: 0,
}));

const transaction = Object.assign(
  (strings: TemplateStringsArray, ...values: unknown[]) => {
    dependencies.rawValues.push(values);
    const text = strings.join(' ');
    if (text.includes('INSERT INTO customer_sessions')) return Promise.resolve([{ token_hash: 'a'.repeat(64) }]);
    return Promise.resolve([]);
  },
  {},
);

const query = Object.assign(
  () => Promise.resolve([]),
  { begin: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction) },
);

function databaseMock() {
  return {
    select: () => {
      dependencies.selectCalls += 1;
      const call = dependencies.selectCalls;
      return {
        from: () => ({
          where: () => call === 1
            ? { limit: async () => [{ credentialVersion: 1 }] }
            : Promise.resolve(dependencies.rows),
        }),
      };
    },
  };
}

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  getQueryClient: () => query,
  getDb: databaseMock,
}));

describe('customer session timestamp boundary', () => {
  beforeEach(() => {
    dependencies.rawValues.length = 0;
    dependencies.rows = [];
    dependencies.selectCalls = 0;
  });

  it('serializes all raw SQL session timestamps as ISO strings', async () => {
    const { createCustomerSession } = await import('../../server/lib/customerSessionStore.js');
    const token = await createCustomerSession('user-test', { credentialVersion: 1 });
    expect(token).toHaveLength(64);

    const flattened = dependencies.rawValues.flat();
    expect(flattened.some(value => value instanceof Date)).toBe(false);
    expect(flattened.filter(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))).toHaveLength(3);
  });

  it('accepts raw timestamp strings when listing active sessions', async () => {
    dependencies.rows = [{
      tokenHash: 'b'.repeat(64), userId: 'user-test', credentialVersion: 1,
      ip: '127.0.0.1', ua: 'test',
      createdAt: '2026-08-30T12:00:00.000Z',
      lastSeenAt: new Date(Date.now() - 1_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }];
    const { listCustomerSessions } = await import('../../server/lib/customerSessionStore.js');
    await expect(listCustomerSessions('user-test', 'c'.repeat(64))).resolves.toHaveLength(1);
  });

  it('fails closed when a persisted timestamp is malformed', async () => {
    dependencies.rows = [{
      tokenHash: 'b'.repeat(64), userId: 'user-test', credentialVersion: 1,
      ip: '127.0.0.1', ua: 'test', createdAt: 'not-a-date',
      lastSeenAt: 'not-a-date', expiresAt: 'not-a-date',
    }];
    const { listCustomerSessions } = await import('../../server/lib/customerSessionStore.js');
    await expect(listCustomerSessions('user-test', 'c'.repeat(64))).resolves.toEqual([]);
  });
});
