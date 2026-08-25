import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  findUserById: vi.fn(),
  updateUser: vi.fn(),
  appendAudit: vi.fn(),
  appendCriticalAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../server/lib/userStore.js', () => ({
  findUserById: dependencies.findUserById,
  updateUser: dependencies.updateUser,
}));
vi.mock('../../server/lib/auditLog.js', () => ({
  appendAudit: dependencies.appendAudit,
  appendCriticalAudit: dependencies.appendCriticalAudit,
}));

import resetCustomerTwoFactor from '../../server/api/admin/users/reset-2fa/POST.js';

function responseDouble() {
  const state: { status: number; body?: unknown } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  } as unknown as Response;
  return { res, state };
}

describe('administrator customer 2FA reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.findUserById.mockResolvedValue({
      id: 'customer-2fa-1',
      email: 'customer@example.test',
      name: 'Customer',
      totpSecret: 'persisted-totp-secret',
      totpEnabled: true,
    });
    dependencies.updateUser.mockResolvedValue({ id: 'customer-2fa-1' });
  });

  it('explicitly clears the persisted TOTP secret', async () => {
    const result = responseDouble();
    await resetCustomerTwoFactor({
      body: { userId: 'customer-2fa-1', reason: 'Customer identity recovery', confirmation: 'CONFIRM CUSTOMER 2FA RESET' },
      ip: '127.0.0.1',
      adminSession: {
        adminId: 'admin-1',
        email: 'admin@example.test',
        role: 'SUPER_ADMIN',
        createdAt: new Date().toISOString(),
      },
    } as unknown as Request, result.res);

    expect(result.state.status).toBe(200);
    expect(dependencies.updateUser).toHaveBeenCalledWith(
      'customer-2fa-1',
      expect.objectContaining({
        totpSecret: null,
        totpEnabled: false,
      }),
    );
    expect(dependencies.appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_user_2fa_reset',
      userId: 'customer-2fa-1',
    }));
  });
});
