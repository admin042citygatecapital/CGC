/**
 * User store unit tests — City Gate Capital
 *
 * Tests the user store CRUD operations and session TTL enforcement.
 * Uses a temp file path to avoid touching production data.
 */

import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the fs module to use in-memory storage
const mockUsers: string[] = [];
vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => false,
  getDb: () => { throw new Error('database fallback test must not call getDb'); },
}));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const overrides = {
    existsSync: vi.fn((p: string) => {
      if (String(p).includes('users.jsonl')) return mockUsers.length > 0;
      return actual.existsSync(p);
    }),
    readFileSync: vi.fn((p: string, enc?: unknown) => {
      if (String(p).includes('users.jsonl')) return mockUsers.join('\n') + '\n';
      return actual.readFileSync(p, enc as BufferEncoding);
    }),
    writeFileSync: vi.fn((p: string, data: string) => {
      if (String(p).includes('users.jsonl')) {
        mockUsers.length = 0;
        const lines = String(data).split('\n').filter(Boolean);
        mockUsers.push(...lines);
        return;
      }
      return actual.writeFileSync(p, data);
    }),
    mkdirSync: vi.fn(),
  };
  return {
    ...actual,
    ...overrides,
    default: { ...actual, ...overrides },
  };
});

describe('userStore', () => {
  beforeEach(() => {
    mockUsers.length = 0;
  });

  it('creates a user with a generated ID', async () => {
    const { createUser, findUserById } = await import('../../server/lib/userStore.js');
    const user = await createUser({
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: '$2b$12$fakehash',
      status: 'pending_verification',
      kycStatus: 'not_submitted',
      emailVerified: false,
    });
    expect(user.id).toMatch(/^usr_[0-9a-f]{16}$/);
    const found = await findUserById(user.id);
    expect(found?.email).toBe('test@example.com');
  });

  it('finds user by email (case-insensitive)', async () => {
    const { createUser, findUserByEmail } = await import('../../server/lib/userStore.js');
    await createUser({
      email: 'UPPER@EXAMPLE.COM',
      name: 'Upper User',
      passwordHash: '$2b$12$fakehash',
      status: 'active',
      kycStatus: 'approved',
      emailVerified: true,
    });
    const found = await findUserByEmail('upper@example.com');
    expect(found).toBeTruthy();
    expect(found?.name).toBe('Upper User');
  });

  it('updates user fields', async () => {
    const { createUser, updateUser, findUserById } = await import('../../server/lib/userStore.js');
    const user = await createUser({
      email: 'update@example.com',
      name: 'Before',
      passwordHash: '$2b$12$fakehash',
      status: 'active',
      kycStatus: 'not_submitted',
      emailVerified: true,
    });
    await updateUser(user.id, { name: 'After' });
    const updated = await findUserById(user.id);
    expect(updated?.name).toBe('After');
  });

  it('clears verification and 2FA secrets when explicitly set to null', async () => {
    const { createUser, updateUser, findUserById } = await import('../../server/lib/userStore.js');
    const user = await createUser({
      email: 'clear@example.com',
      name: 'Clear Secrets',
      passwordHash: '$2b$12$fakehash',
      status: 'pending_verification',
      kycStatus: 'not_submitted',
      emailVerified: false,
      emailVerifyToken: 'verification-secret',
      emailVerifyExpiry: new Date(Date.now() + 60_000).toISOString(),
      totpSecret: 'totp-secret',
    });

    await updateUser(user.id, {
      emailVerifyToken: null,
      emailVerifyExpiry: null,
      totpSecret: null,
      totpEnabled: false,
    });

    const updated = await findUserById(user.id);
    expect(updated?.emailVerifyToken).toBeUndefined();
    expect(updated?.emailVerifyExpiry).toBeUndefined();
    expect(updated?.totpSecret).toBeUndefined();
    expect(updated?.totpEnabled).toBe(false);
    expect(mockUsers.join('\n')).not.toContain('verification-secret');
    expect(mockUsers.join('\n')).not.toContain('totp-secret');
  });

  it('returns null for non-existent user', async () => {
    const { findUserById } = await import('../../server/lib/userStore.js');
    await expect(findUserById('usr_nonexistent')).resolves.toBeUndefined();
  });

  it('detects duplicate email', async () => {
    const { createUser, detectDuplicate } = await import('../../server/lib/userStore.js');
    await createUser({
      email: 'dup@example.com',
      name: 'Dup',
      passwordHash: '$2b$12$fakehash',
      status: 'active',
      kycStatus: 'not_submitted',
      emailVerified: true,
    });
    const result = await detectDuplicate('dup@example.com');
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe('email_exists');
  });

  it('generates a verify token with 24h expiry', async () => {
    const { generateVerifyToken } = await import('../../server/lib/userStore.js');
    const { token, expiry } = generateVerifyToken();
    expect(token).toHaveLength(64);
    const expiryMs = new Date(expiry).getTime();
    const nowMs = Date.now();
    // Should be ~24 hours from now (within 1 minute tolerance)
    expect(expiryMs - nowMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(expiryMs - nowMs).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it('persists and revokes a development customer session', async () => {
    const { createUser, findUserBySessionToken } = await import('../../server/lib/userStore.js');
    const { createCustomerSession, deleteCustomerSession } = await import('../../server/lib/customerSessionStore.js');
    const user = await createUser({
      email: 'session@example.com', name: 'Session User', passwordHash: '$2b$12$fakehash',
      status: 'active', kycStatus: 'approved', emailVerified: true,
    });

    const token = await createCustomerSession(user.id, {
      ip: '127.0.0.1',
      ua: 'vitest',
      credentialVersion: user.credentialVersion,
    });
    expect(token).not.toBeNull();
    if (!token) throw new Error('Expected a customer session token.');
    const persisted = mockUsers.join('\n');
    expect(persisted).not.toContain(token);
    expect(JSON.parse(mockUsers[0]).sessionToken).toBe(
      `sha256:${crypto.createHash('sha256').update(token).digest('hex')}`,
    );
    expect((await findUserBySessionToken(token))?.id).toBe(user.id);
    await deleteCustomerSession(token);
    expect(await findUserBySessionToken(token)).toBeUndefined();
    expect(mockUsers.join('\n')).not.toContain(token);
  });

  it('revokes legacy development customer sessions that stored a bearer token', async () => {
    const rawToken = 'c'.repeat(64);
    mockUsers.push(JSON.stringify({
      id: 'usr_legacy', email: 'legacy@example.com', name: 'Legacy',
      passwordHash: '$2b$12$fakehash', status: 'active', kycStatus: 'approved',
      emailVerified: true, loginAttempts: 0, amlStatus: 'not_screened',
      amlRiskLevel: 'unrated', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), sessionToken: rawToken,
      sessionCreatedAt: new Date().toISOString(),
      sessionLastSeenAt: new Date().toISOString(),
    }));

    const { findUserBySessionToken, findUserById } = await import('../../server/lib/userStore.js');
    await expect(findUserBySessionToken(rawToken)).resolves.toBeUndefined();
    expect((await findUserById('usr_legacy'))?.sessionToken).toBeUndefined();
    expect(mockUsers.join('\n')).not.toContain(rawToken);
  });
});
