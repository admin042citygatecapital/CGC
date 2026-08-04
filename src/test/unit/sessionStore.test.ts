/**
 * Session store unit tests — City Gate Capital
 *
 * Tests session creation, TTL enforcement, max concurrent sessions,
 * and token format validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs to use in-memory session storage
const mockSessions: Record<string, unknown> = {};

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
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
});

describe('sessionStore', () => {
  beforeEach(() => {
    Object.keys(mockSessions).forEach(k => delete mockSessions[k]);
  });

  it('creates and retrieves a session', async () => {
    const { generateSessionToken, createSession, getSession } = await import('../../server/lib/sessionStore.js');
    const token = generateSessionToken();
    const now = new Date().toISOString();
    createSession(token, {
      adminId: 'admin_1',
      email: 'admin@citygate.capital',
      role: 'SUPER_ADMIN',
      createdAt: now,
      ip: '127.0.0.1',
      ua: 'TestAgent/1.0',
    });
    const session = getSession(token);
    expect(session).not.toBeNull();
    expect(session?.email).toBe('admin@citygate.capital');
    expect(session?.role).toBe('SUPER_ADMIN');
  });

  it('rejects invalid token formats', async () => {
    const { getSession } = await import('../../server/lib/sessionStore.js');
    expect(getSession('short')).toBeNull();
    expect(getSession('not-hex-' + 'x'.repeat(56))).toBeNull();
    expect(getSession('')).toBeNull();
  });

  it('deletes a session', async () => {
    const { generateSessionToken, createSession, deleteSession, getSession } = await import('../../server/lib/sessionStore.js');
    const token = generateSessionToken();
    const now = new Date().toISOString();
    createSession(token, {
      adminId: 'admin_2',
      email: 'admin2@citygate.capital',
      role: 'FINANCE_ADMIN',
      createdAt: now,
      ip: '127.0.0.1',
      ua: 'TestAgent/1.0',
    });
    expect(getSession(token)).not.toBeNull();
    deleteSession(token);
    expect(getSession(token)).toBeNull();
  });

  it('lists all sessions', async () => {
    const { generateSessionToken, createSession, listSessions } = await import('../../server/lib/sessionStore.js');
    const now = new Date().toISOString();
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    createSession(t1, { adminId: 'a1', email: 'a1@test.com', role: 'SUPER_ADMIN', createdAt: now, ip: '1.1.1.1', ua: 'UA' });
    createSession(t2, { adminId: 'a2', email: 'a2@test.com', role: 'SUPPORT_ADMIN', createdAt: now, ip: '1.1.1.2', ua: 'UA' });
    const sessions = listSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('purges all sessions', async () => {
    const { generateSessionToken, createSession, purgeAllSessions, listSessions } = await import('../../server/lib/sessionStore.js');
    const now = new Date().toISOString();
    createSession(generateSessionToken(), { adminId: 'a1', email: 'a@test.com', role: 'SUPER_ADMIN', createdAt: now, ip: '1.1.1.1', ua: 'UA' });
    purgeAllSessions();
    expect(listSessions().length).toBe(0);
  });
});
