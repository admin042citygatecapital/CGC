/**
 * Session store unit tests — City Gate Capital
 *
 * Tests session creation, TTL enforcement, max concurrent sessions,
 * and token format validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// Mock fs to use in-memory session storage
const mockSessions: Record<string, unknown> = {};

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => false,
  getDb: () => { throw new Error('database fallback test must not call getDb'); },
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const overrides = {
    existsSync: vi.fn((p: string) => {
      if (String(p).includes('sessions.json')) return Object.keys(mockSessions).length > 0;
      return actual.existsSync(p);
    }),
    readFileSync: vi.fn((p: string, enc?: unknown) => {
      if (String(p).includes('sessions.json')) return JSON.stringify(mockSessions);
      return actual.readFileSync(p, enc as BufferEncoding);
    }),
    writeFileSync: vi.fn((p: string, data: string) => {
      if (String(p).includes('sessions.json')) {
        const parsed = JSON.parse(data);
        Object.keys(mockSessions).forEach(k => delete mockSessions[k]);
        Object.assign(mockSessions, parsed);
        return;
      }
      return actual.writeFileSync(p, data);
    }),
    renameSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
  return {
    ...actual,
    ...overrides,
    default: { ...actual, ...overrides },
  };
});

describe('sessionStore', () => {
  beforeEach(() => {
    Object.keys(mockSessions).forEach(k => delete mockSessions[k]);
  });

  it('creates and retrieves a session', async () => {
    const { generateSessionToken, createSession, getSession } = await import('../../server/lib/sessionStore.js');
    const token = generateSessionToken();
    const now = new Date().toISOString();
    await createSession(token, {
      adminId: 'admin_1',
      email: 'admin@citygate.capital',
      role: 'SUPER_ADMIN',
      credentialVersion: 1,
      createdAt: now,
      ip: '127.0.0.1',
      ua: 'TestAgent/1.0',
    });
    const serialized = JSON.stringify(mockSessions);
    expect(serialized).not.toContain(token);
    expect(Object.keys(mockSessions)).toEqual([
      `sha256:${crypto.createHash('sha256').update(token).digest('hex')}`,
    ]);
    const session = await getSession(token);
    expect(session).not.toBeNull();
    expect(session?.email).toBe('admin@citygate.capital');
    expect(session?.role).toBe('SUPER_ADMIN');
  });

  it('rejects invalid token formats', async () => {
    const { getSession } = await import('../../server/lib/sessionStore.js');
    await expect(getSession('short')).resolves.toBeNull();
    await expect(getSession('not-hex-' + 'x'.repeat(56))).resolves.toBeNull();
    await expect(getSession('')).resolves.toBeNull();
  });

  it('deletes a session', async () => {
    const { generateSessionToken, createSession, deleteSession, getSession } = await import('../../server/lib/sessionStore.js');
    const token = generateSessionToken();
    const now = new Date().toISOString();
    await createSession(token, {
      adminId: 'admin_2',
      email: 'admin2@citygate.capital',
      role: 'FINANCE_ADMIN',
      credentialVersion: 1,
      createdAt: now,
      ip: '127.0.0.1',
      ua: 'TestAgent/1.0',
    });
    await expect(getSession(token)).resolves.not.toBeNull();
    await deleteSession(token);
    await expect(getSession(token)).resolves.toBeNull();
  });

  it('lists all sessions', async () => {
    const { generateSessionToken, createSession, listSessions } = await import('../../server/lib/sessionStore.js');
    const now = new Date().toISOString();
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    await createSession(t1, { adminId: 'a1', email: 'a1@test.com', role: 'SUPER_ADMIN', credentialVersion: 1, createdAt: now, ip: '1.1.1.1', ua: 'UA' });
    await createSession(t2, { adminId: 'a2', email: 'a2@test.com', role: 'SUPPORT_ADMIN', credentialVersion: 1, createdAt: now, ip: '1.1.1.2', ua: 'UA' });
    const sessions = await listSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('purges all sessions', async () => {
    const { generateSessionToken, createSession, purgeAllSessions, listSessions } = await import('../../server/lib/sessionStore.js');
    const now = new Date().toISOString();
    await createSession(generateSessionToken(), { adminId: 'a1', email: 'a@test.com', role: 'SUPER_ADMIN', credentialVersion: 1, createdAt: now, ip: '1.1.1.1', ua: 'UA' });
    await purgeAllSessions();
    expect((await listSessions()).length).toBe(0);
  });

  it('revokes legacy flat-file rows that use raw bearer tokens as keys', async () => {
    const rawToken = 'b'.repeat(64);
    mockSessions[rawToken] = {
      adminId: 'legacy', email: 'legacy@example.com', role: 'SUPER_ADMIN',
      createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
      ip: '127.0.0.1', ua: 'Legacy',
    };

    const { listSessions, getSession } = await import('../../server/lib/sessionStore.js');
    await expect(listSessions()).resolves.toEqual([]);
    expect(mockSessions).toEqual({});
    await expect(getSession(rawToken)).resolves.toBeNull();
  });

  it('rejects a session presented from a different fingerprint', async () => {
    const { generateSessionToken, createSession, getSession } = await import('../../server/lib/sessionStore.js');
    const token = generateSessionToken();
    const now = new Date().toISOString();
    await createSession(token, {
      adminId: 'admin_3', email: 'admin3@citygate.capital', role: 'SECURITY_ADMIN',
      credentialVersion: 1,
      createdAt: now, ip: '127.0.0.1', ua: 'TestAgent/1.0',
    });
    await expect(getSession(token, { ip: '127.0.0.2', ua: 'TestAgent/1.0' })).resolves.toBeNull();
  });
});
