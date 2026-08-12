import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  findUserById: vi.fn(),
  updateUser: vi.fn(),
  appendAuditEntry: vi.fn(),
  appendCriticalAudit: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock('../../server/lib/userStore.js', () => ({
  findUserById: dependencies.findUserById,
  updateUser: dependencies.updateUser,
}));
vi.mock('../../server/lib/auditLog.js', () => ({
  appendAuditEntry: dependencies.appendAuditEntry,
  appendCriticalAudit: dependencies.appendCriticalAudit,
}));
vi.mock('../../server/lib/notificationStore.js', () => ({ createNotification: dependencies.createNotification }));

import actionHandler from '../../server/api/admin/users/action/POST.js';
import deleteHandler from '../../server/api/admin/users/delete/POST.js';

const user = {
  id: 'usr-test', email: 'customer@example.test', name: 'Test Customer', status: 'active',
  emailVerified: true, kycStatus: 'approved', amlStatus: 'cleared',
};

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function request(body: Record<string, unknown>) {
  return { body, ip: '127.0.0.1', adminSession: { adminId: 'super-admin', email: 'admin@example.test', role: 'SUPER_ADMIN' } };
}

describe('admin customer lifecycle audit controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.findUserById.mockResolvedValue(user);
    dependencies.updateUser.mockResolvedValue({ ...user, status: 'suspended' });
    dependencies.appendCriticalAudit.mockResolvedValue(undefined);
    dependencies.appendAuditEntry.mockResolvedValue(undefined);
    dependencies.createNotification.mockResolvedValue(undefined);
  });

  it('fails closed before suspending a customer when the audit intent cannot persist', async () => {
    dependencies.appendCriticalAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(actionHandler(request({ userId: user.id, action: 'suspend', reason: 'Confirmed security investigation.' }) as never, response() as never)).rejects.toThrow('audit unavailable');

    expect(dependencies.updateUser).not.toHaveBeenCalled();
  });

  it('records the intent before a reversible suspension and retains a completion record', async () => {
    const res = response();
    await actionHandler(request({ userId: user.id, action: 'suspend', reason: 'Confirmed security investigation.' }) as never, res as never);

    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_user_suspend_intent' }));
    expect(dependencies.appendCriticalAudit.mock.invocationCallOrder[0]).toBeLessThan(dependencies.updateUser.mock.invocationCallOrder[0]);
    expect(dependencies.appendAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_user_suspend' }));
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('blocks hard deletion while recording the attempted destructive action', async () => {
    const res = response();
    await deleteHandler(request({ userId: user.id, reason: 'Customer requested profile deletion.' }) as never, res as never);

    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_user_hard_delete_blocked' }));
    expect(dependencies.updateUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'HARD_DELETE_DISABLED' }));
  });
});
