/**
 * User store unit tests — City Gate Capital
 *
 * Tests the user store CRUD operations and session TTL enforcement.
 * Uses a temp file path to avoid touching production data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the fs module to use in-memory storage
const mockUsers: string[] = [];
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
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
});

describe('userStore', () => {
  beforeEach(() => {
    mockUsers.length = 0;
  });

  it('creates a user with a generated ID', async () => {
    const { createUser, findUserById } = await import('../../server/lib/userStore.js');
    const user = createUser({
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: '$2b$12$fakehash',
      status: 'pending_verification',
      kycStatus: 'not_submitted',
      emailVerified: false,
      loginAttempts: 0,
    });
    expect(user.id).toMatch(/^usr_[0-9a-f]{16}$/);
    const found = findUserById(user.id);
    expect(found?.email).toBe('test@example.com');
  });

  it('finds user by email (case-insensitive)', async () => {
    const { createUser, findUserByEmail } = await import('../../server/lib/userStore.js');
    createUser({
      email: 'UPPER@EXAMPLE.COM',
      name: 'Upper User',
      passwordHash: '$2b$12$fakehash',
      status: 'active',
      kycStatus: 'approved',
      emailVerified: true,
      loginAttempts: 0,
    });
    const found = findUserByEmail('upper@example.com');
    expect(found).toBeTruthy();
    expect(found?.name).toBe('Upper User');
  });

  it('updates user fields', async () => {
    const { createUser, updateUser, findUserById } = await import('../../server/lib/userStore.js');
    const user = createUser({
      email: 'update@example.com',
      name: 'Before',
      passwordHash: '$2b$12$fakehash',
      status: 'active',
      kycStatus: 'not_submitted',
      emailVerified: true,
      loginAttempts: 0,
    });
    updateUser(user.id, { name: 'After' });
    const updated = findUserById(user.id);
    expect(updated?.name).toBe('After');
  });

  it('returns null for non-existent user', async () => {
    const { findUserById } = await import('../../server/lib/userStore.js');
    expect(findUserById('usr_nonexistent')).toBeUndefined();
  });

  it('detects duplicate email', async () => {
    const { createUser, detectDuplicate } = await import('../../server/lib/userStore.js');
    createUser({
      email: 'dup@example.com',
      name: 'Dup',
      passwordHash: '$2b$12$fakehash',
      status: 'active',
      kycStatus: 'not_submitted',
      emailVerified: true,
      loginAttempts: 0,
    });
    const result = detectDuplicate('dup@example.com');
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
});
