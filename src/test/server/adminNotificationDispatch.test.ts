import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  appendCriticalAudit: vi.fn(),
  createNotification: vi.fn(),
  loadAllUsers: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  query: vi.fn(),
}));

vi.mock('../../server/lib/auditLog.js', () => ({ appendCriticalAudit: dependencies.appendCriticalAudit }));
vi.mock('../../server/lib/notificationStore.js', () => ({ createNotification: dependencies.createNotification }));
vi.mock('../../server/lib/userStore.js', () => ({ loadAllUsers: dependencies.loadAllUsers }));
vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: dependencies.isDatabaseConfigured,
  getQueryClient: () => dependencies.query,
}));

function request(overrides: Record<string, unknown> = {}): Request {
  const headers = new Map<string, string>();
  if (typeof overrides.idempotencyKey === 'string') headers.set('idempotency-key', overrides.idempotencyKey);
  return {
    body: {
      category: 'customer', targetType: 'customer', userId: 'user_001',
      title: 'Account update', message: 'Your account information was updated.',
      reason: 'Customer requested an account update.',
    },
    adminSession: { adminId: 'admin_001', email: 'admin@example.test', role: 'SUPER_ADMIN' },
    ip: '127.0.0.1',
    get: vi.fn((name: string) => headers.get(name.toLowerCase())),
    ...overrides,
  } as unknown as Request;
}

function response(): Response {
  const res = { status: vi.fn(() => res), json: vi.fn(() => res) };
  return res as unknown as Response;
}

describe('admin notification dispatch reliability boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.isDatabaseConfigured.mockReturnValue(false);
    dependencies.loadAllUsers.mockResolvedValue([{ id: 'user_001', status: 'active', country: 'GB', accountTier: 'standard' }]);
    dependencies.createNotification.mockResolvedValue({ id: 'notif_001' });
  });

  it('requires an idempotency key before resolving recipients', async () => {
    const handler = (await import('../../server/api/admin/notifications/POST.js')).default;
    const res = response();

    await handler(request(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dependencies.loadAllUsers).not.toHaveBeenCalled();
    expect(dependencies.createNotification).not.toHaveBeenCalled();
  });

  it('fails closed before delivery when critical audit storage is unavailable', async () => {
    dependencies.appendCriticalAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    const handler = (await import('../../server/api/admin/notifications/POST.js')).default;

    await expect(handler(request({ idempotencyKey: 'notification:test-001' }), response())).rejects.toThrow('audit unavailable');
    expect(dependencies.createNotification).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key with a different request fingerprint', async () => {
    dependencies.isDatabaseConfigured.mockReturnValue(true);
    dependencies.query.mockResolvedValueOnce([{
      id: 'nd_existing', requestFingerprint: 'different-fingerprint', status: 'completed',
      recipientCount: 1, deliveredCount: 1, failedCount: 0,
    }]);
    const handler = (await import('../../server/api/admin/notifications/POST.js')).default;
    const res = response();

    await handler(request({ idempotencyKey: 'notification:test-002' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(dependencies.loadAllUsers).not.toHaveBeenCalled();
    expect(dependencies.createNotification).not.toHaveBeenCalled();
  });

  it('replays a completed dispatch without delivering a duplicate notification', async () => {
    dependencies.isDatabaseConfigured.mockReturnValue(true);
    const normalizedRequest = {
      category: 'customer', targetType: 'customer', userId: 'user_001',
      title: 'Account update', message: 'Your account information was updated.',
      link: '', reason: 'Customer requested an account update.', group: {},
    };
    dependencies.query.mockResolvedValueOnce([{
      id: 'nd_existing',
      requestFingerprint: crypto.createHash('sha256').update(JSON.stringify(normalizedRequest)).digest('hex'),
      status: 'completed', recipientCount: 1, deliveredCount: 1, failedCount: 0,
    }]);
    const handler = (await import('../../server/api/admin/notifications/POST.js')).default;
    const res = response();

    await handler(request({ idempotencyKey: 'notification:test-003' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ replayed: true, dispatchId: 'nd_existing' }));
    expect(dependencies.appendCriticalAudit).not.toHaveBeenCalled();
    expect(dependencies.loadAllUsers).not.toHaveBeenCalled();
    expect(dependencies.createNotification).not.toHaveBeenCalled();
  });
});
