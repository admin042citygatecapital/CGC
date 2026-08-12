import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  readKycSettings: vi.fn(),
  writeKycSettings: vi.fn(),
  appendAudit: vi.fn(),
  appendCriticalAudit: vi.fn(),
}));

vi.mock('../../server/lib/kycStore.js', () => ({
  readKycSettings: dependencies.readKycSettings,
  writeKycSettings: dependencies.writeKycSettings,
}));

vi.mock('../../server/lib/auditLog.js', () => ({
  appendAudit: dependencies.appendAudit,
  appendCriticalAudit: dependencies.appendCriticalAudit,
}));

import handler from '../../server/api/admin/kyc/settings/POST.js';

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function request(body: Record<string, unknown>) {
  return {
    body,
    ip: '127.0.0.1',
    adminSession: { adminId: 'super-admin', email: 'admin@example.test', role: 'SUPER_ADMIN' },
  };
}

describe('admin KYC settings controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.readKycSettings.mockResolvedValue({ expiryMonths: 12, renewalReminderDays: 30, autoRestrictExpired: true });
    dependencies.writeKycSettings.mockResolvedValue(undefined);
    dependencies.appendCriticalAudit.mockResolvedValue(undefined);
  });

  it('rejects ambiguous booleans and out-of-range lifecycle settings', async () => {
    const booleanResponse = response();
    await handler(request({ autoRestrictExpired: 'false' }) as never, booleanResponse as never);
    expect(booleanResponse.status).toHaveBeenCalledWith(400);

    const rangeResponse = response();
    await handler(request({ expiryMonths: 0 }) as never, rangeResponse as never);
    expect(rangeResponse.status).toHaveBeenCalledWith(400);
    expect(dependencies.writeKycSettings).not.toHaveBeenCalled();
  });

  it('fails closed before changing settings when the critical audit intent cannot persist', async () => {
    dependencies.appendCriticalAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(handler(request({ expiryMonths: 24 }) as never, response() as never)).rejects.toThrow('audit unavailable');

    expect(dependencies.writeKycSettings).not.toHaveBeenCalled();
  });

  it('persists the audit intent before writing validated settings', async () => {
    const res = response();
    await handler(request({ expiryMonths: 24, renewalReminderDays: 60, autoRestrictExpired: false }) as never, res as never);

    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_kyc_settings_update_intent' }));
    expect(dependencies.appendCriticalAudit.mock.invocationCallOrder[0]).toBeLessThan(dependencies.writeKycSettings.mock.invocationCallOrder[0]);
    expect(dependencies.writeKycSettings).toHaveBeenCalledWith(expect.objectContaining({ expiryMonths: 24, renewalReminderDays: 60, autoRestrictExpired: false }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
