import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  findUserByEmail: vi.fn(),
  generateVerifyToken: vi.fn(),
  createUserWithRegistrationCase: vi.fn(),
  appendAudit: vi.fn(),
  appendCriticalAudit: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  authorizeAdminRole: vi.fn().mockReturnValue(true),
  authorizeRecentAdminStepUp: vi.fn().mockReturnValue(true),
}));

vi.mock('../../server/lib/passwordHash.js', () => ({ hashPassword: dependencies.hashPassword }));
vi.mock('../../server/lib/userStore.js', () => ({
  findUserByEmail: dependencies.findUserByEmail,
  generateVerifyToken: dependencies.generateVerifyToken,
  createUserWithRegistrationCase: dependencies.createUserWithRegistrationCase,
}));
vi.mock('../../server/lib/auditLog.js', () => ({
  appendAudit: dependencies.appendAudit,
  appendCriticalAudit: dependencies.appendCriticalAudit,
}));
vi.mock('../../server/lib/emailService.js', () => ({ sendVerificationEmail: dependencies.sendVerificationEmail }));
vi.mock('../../server/lib/rbacMiddleware.js', () => ({
  authorizeAdminRole: dependencies.authorizeAdminRole,
  authorizeRecentAdminStepUp: dependencies.authorizeRecentAdminStepUp,
}));

import createRegistration from '../../server/api/admin/users/create/POST.js';

function responseDouble() {
  const state: { status: number; body?: unknown } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  } as unknown as Response;
  return { res, state };
}

function request(body: Record<string, unknown>): Request {
  return {
    body,
    ip: '127.0.0.1',
    protocol: 'https',
    hostname: 'citygate.example.test',
    adminSession: {
      adminId: 'admin-1',
      email: 'admin@example.test',
      role: 'SUPER_ADMIN',
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      ip: '127.0.0.1',
      ua: 'vitest',
    },
  } as unknown as Request;
}

describe('administrator-created customer registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.authorizeAdminRole.mockReturnValue(true);
    dependencies.authorizeRecentAdminStepUp.mockReturnValue(true);
    dependencies.findUserByEmail.mockResolvedValue(undefined);
    dependencies.hashPassword.mockResolvedValue('argon2id-test-hash');
    dependencies.generateVerifyToken.mockReturnValue({ token: 'verification-token', expiry: new Date(Date.now() + 60_000).toISOString() });
    dependencies.createUserWithRegistrationCase.mockResolvedValue({
      user: {
        id: 'customer-registration-1',
        name: 'Synthetic Applicant',
        email: 'applicant@example.test',
        status: 'pending_verification',
        kycStatus: 'not_submitted',
        accountTier: 'standard',
      },
      applicationReference: 'CGC-APP-TEST-001',
    });
  });

  it('creates a pending registration and verification workflow without an initial balance', async () => {
    const result = responseDouble();
    await createRegistration(request({
      name: 'Synthetic Applicant',
      email: 'applicant@example.test',
      phone: '+15555550123',
      country: 'US',
      password: 'Strong-Temporary-Password-123!',
      address: '1 Test Avenue',
      city: 'Test City',
      postalCode: '90001',
      requestedProduct: 'personal-account',
      reason: 'Create controlled registration record',
      confirmed: true,
    }), result.res);

    expect(result.state.status).toBe(201);
    expect(result.state.body).toEqual(expect.objectContaining({
      ok: true,
      userId: 'customer-registration-1',
      applicationReference: 'CGC-APP-TEST-001',
    }));
    expect(dependencies.createUserWithRegistrationCase).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending_verification',
      kycStatus: 'not_submitted',
      emailVerified: false,
      requestedProduct: 'personal-account',
    }), 'individual');
    expect(dependencies.createUserWithRegistrationCase.mock.calls[0][0]).not.toHaveProperty('balance');
    expect(dependencies.sendVerificationEmail).toHaveBeenCalledWith(
      'applicant@example.test',
      'Synthetic Applicant',
      'verification-token',
      'https://citygate.example.test',
    );
    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_user_create_intent',
      reason: 'controlled registration record',
    }));
  });

  it('rejects duplicate customer email before hashing or creating a record', async () => {
    dependencies.findUserByEmail.mockResolvedValue({ id: 'existing-customer' });
    const result = responseDouble();
    await createRegistration(request({
      name: 'Synthetic Applicant',
      email: 'applicant@example.test',
      phone: '+15555550123',
      country: 'US',
      password: 'Strong-Temporary-Password-123!',
      address: '1 Test Avenue',
      city: 'Test City',
      postalCode: '90001',
      requestedProduct: 'personal-account',
      reason: 'Create controlled registration record',
      confirmed: true,
    }), result.res);

    expect(result.state.status).toBe(409);
    expect(dependencies.hashPassword).not.toHaveBeenCalled();
    expect(dependencies.createUserWithRegistrationCase).not.toHaveBeenCalled();
  });
});
