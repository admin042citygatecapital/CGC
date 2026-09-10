import { describe, expect, it, vi } from 'vitest';

const { queries, transaction } = vi.hoisted(() => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const transaction = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join('?');
    queries.push({ sql, values });
    if (sql.includes('FROM admins')) return [{ credential_version: 1, is_active: true }];
    if (sql.includes('INSERT INTO admin_sessions')) return [{ token_hash: 'test-hash' }];
    return [];
  };
  return { queries, transaction };
});

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  getDb: () => { throw new Error('This test uses the transactional query client only'); },
  getQueryClient: () => ({
    begin: (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
  }),
}));

describe('database session eviction', () => {
  it('retains the four newest existing sessions before inserting the fifth', async () => {
    queries.length = 0;
    const { createSession } = await import('../../server/lib/sessionStore.js');
    await expect(createSession('a'.repeat(64), {
      adminId: 'test-admin', email: 'admin@example.test', role: 'SUPER_ADMIN',
      credentialVersion: 1, createdAt: new Date().toISOString(),
      ip: '127.0.0.1', ua: 'TestAgent',
    })).resolves.toBe(true);

    const eviction = queries.find(query => query.sql.includes('DELETE FROM admin_sessions'));
    expect(eviction).toBeDefined();
    expect(eviction!.sql).toMatch(/ORDER BY created_at DESC, token_hash DESC\s+OFFSET/);
    expect(eviction!.values).toEqual(['test-admin', 4]);
    const lockIndex = queries.findIndex(query => query.sql.includes('pg_advisory_xact_lock'));
    const evictionIndex = queries.indexOf(eviction!);
    const insertIndex = queries.findIndex(query => query.sql.includes('INSERT INTO admin_sessions'));
    expect(lockIndex).toBeLessThan(evictionIndex);
    expect(evictionIndex).toBeLessThan(insertIndex);
  });
});
