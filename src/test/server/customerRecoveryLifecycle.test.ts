import { readFileSync } from 'node:fs';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  findUserByVerifyToken: vi.fn(),
  updateUser: vi.fn(),
  loadAllUsers: vi.fn(),
  appendAudit: vi.fn(),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  hashPassword: vi.fn().mockResolvedValue('argon2-new-hash'),
  deleteAllCustomerSessions: vi.fn().mockResolvedValue(3),
}));

vi.mock('../../server/lib/userStore.js', () => ({
  findUserByVerifyToken: dependencies.findUserByVerifyToken,
  updateUser: dependencies.updateUser,
  loadAllUsers: dependencies.loadAllUsers,
}));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit: dependencies.appendAudit }));
vi.mock('../../server/lib/emailService.js', () => ({ sendWelcomeEmail: dependencies.sendWelcomeEmail }));
vi.mock('../../server/lib/passwordHash.js', () => ({ hashPassword: dependencies.hashPassword }));
vi.mock('../../server/lib/customerSessionStore.js', () => ({
  deleteAllCustomerSessions: dependencies.deleteAllCustomerSessions,
}));

import verifyEmail from '../../server/api/users/verify-email/GET.js';
import confirmPasswordReset from '../../server/api/users/password-reset/confirm/POST.js';

function responseDouble() {
  const state: { status: number; body?: unknown; redirect?: string } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
    redirect(url: string) { state.redirect = url; return this; },
  } as unknown as Response;
  return { res, state };
}

describe('customer verification and credential recovery lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends verification links to the registered server route', () => {
    const source = readFileSync('src/server/lib/emailService.ts', 'utf8');
    expect(source).toContain('/api/users/verify-email?token=${encodeURIComponent(token)}');
    expect(source).not.toContain('`${baseUrl}/verify-email?token=');
  });

  it('verifies email once, advances the customer to KYC, and audits the event', async () => {
    const user = {
      id: 'customer-verify-1', email: 'verify@example.test', name: 'Verify Customer',
      emailVerified: false, emailVerifyExpiry: new Date(Date.now() + 60_000).toISOString(),
    };
    dependencies.findUserByVerifyToken.mockResolvedValue(user);
    const result = responseDouble();

    await verifyEmail({ query: { token: 'single-use-token' } } as unknown as Request, result.res);

    expect(result.state.redirect).toBe('/login?verified=success');
    expect(dependencies.updateUser).toHaveBeenCalledWith(user.id, expect.objectContaining({
      emailVerified: true, status: 'pending_kyc', emailVerifyToken: undefined,
    }));
    expect(dependencies.appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'email_verified', userId: user.id,
    }));
  });

  it('changes the password, consumes the reset token, and revokes all sessions', async () => {
    const user = {
      id: 'customer-reset-1', email: 'reset@example.test',
      passwordResetToken: 'reset-token',
      passwordResetExpiry: new Date(Date.now() + 60_000).toISOString(),
    };
    dependencies.loadAllUsers.mockResolvedValue([user]);
    const result = responseDouble();

    await confirmPasswordReset({
      body: { token: 'reset-token', password: 'Replacement-Password-42!' }, ip: '127.0.0.1',
    } as unknown as Request, result.res);

    expect(result.state.status).toBe(200);
    expect(dependencies.updateUser).toHaveBeenCalledWith(user.id, expect.objectContaining({
      passwordHash: 'argon2-new-hash', passwordResetToken: undefined, passwordResetExpiry: undefined,
    }));
    expect(dependencies.deleteAllCustomerSessions).toHaveBeenCalledWith(user.id);
    expect(dependencies.appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'password_reset_completed', meta: { revokedSessions: 3 },
    }));
  });
});
