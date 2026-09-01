import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  lastSeenAt: new Date().toISOString(),
  statements: [] as string[],
  values: [] as unknown[][],
}));

const transaction = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const statement = strings.join(' ');
  dependencies.statements.push(statement);
  dependencies.values.push(values);

  if (statement.includes('SELECT admin_id FROM admin_sessions')) {
    return Promise.resolve([{ admin_id: 'admin-test' }]);
  }
  if (statement.includes('pg_advisory_xact_lock_shared')) return Promise.resolve([]);
  if (statement.includes('FROM admin_sessions s')) {
    return Promise.resolve([{
      admin_id: 'admin-test',
      email: 'admin@example.test',
      role: 'SUPER_ADMIN',
      credential_version: 3,
      current_credential_version: 3,
      is_active: true,
      ip: '127.0.0.1',
      ua: 'vitest',
      created_at: new Date(Date.now() - 60_000).toISOString(),
      last_seen_at: dependencies.lastSeenAt,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }]);
  }
  return Promise.resolve([]);
};

const query = Object.assign(transaction, {
  begin: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
});

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  getQueryClient: () => query,
  getDb: vi.fn(),
}));

describe('administrator session concurrency boundary', () => {
  beforeEach(() => {
    dependencies.lastSeenAt = new Date().toISOString();
    dependencies.statements.length = 0;
    dependencies.values.length = 0;
  });

  it('uses a shared credential lock and does not row-lock or touch a fresh session', async () => {
    const { getSession } = await import('../../server/lib/sessionStore.js');
    const session = await getSession('a'.repeat(64), { ip: '127.0.0.1', ua: 'vitest' });

    expect(session?.adminId).toBe('admin-test');
    expect(dependencies.statements.some(statement => statement.includes('pg_advisory_xact_lock_shared'))).toBe(true);
    expect(dependencies.statements.some(statement => statement.includes('FOR UPDATE'))).toBe(false);
    expect(dependencies.statements.some(statement => statement.includes('UPDATE admin_sessions SET last_seen_at'))).toBe(false);
  });

  it('touches a stale session using an ISO timestamp and no JavaScript Date value', async () => {
    dependencies.lastSeenAt = new Date(Date.now() - 60_000).toISOString();
    const { getSession } = await import('../../server/lib/sessionStore.js');
    await expect(getSession('b'.repeat(64), { ip: '127.0.0.1', ua: 'vitest' })).resolves.not.toBeNull();

    expect(dependencies.statements.some(statement => statement.includes('UPDATE admin_sessions SET last_seen_at'))).toBe(true);
    expect(dependencies.values.flat().some(value => value instanceof Date)).toBe(false);
  });

  it('fails closed for a malformed raw timestamp', async () => {
    dependencies.lastSeenAt = 'not-a-timestamp';
    const { getSession } = await import('../../server/lib/sessionStore.js');
    await expect(getSession('c'.repeat(64), { ip: '127.0.0.1', ua: 'vitest' })).resolves.toBeNull();
    expect(dependencies.statements.some(statement => statement.includes('DELETE FROM admin_sessions'))).toBe(true);
  });
});
