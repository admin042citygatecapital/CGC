import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  appendCriticalAudit: vi.fn(),
  appendAudit: vi.fn(),
  updateOperationsItem: vi.fn(),
}));

vi.mock('../../server/lib/auditLog.js', () => ({
  appendCriticalAudit: dependencies.appendCriticalAudit,
  appendAudit: dependencies.appendAudit,
}));
vi.mock('../../server/lib/operationsInboxStore.js', () => ({
  updateOperationsItem: dependencies.updateOperationsItem,
}));

function response(): Response {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res as unknown as Response;
}

describe('operations administration audit boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fails closed before changing an operations record when audit storage fails', async () => {
    dependencies.appendCriticalAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    const handler = (await import('../../server/api/admin/operations/POST.js')).default;
    const req = {
      body: { id: 'op-test', status: 'archived' },
      ip: '127.0.0.1',
      adminSession: { adminId: 'admin-test', email: 'admin@example.test', role: 'SUPER_ADMIN' },
    } as unknown as Request;

    await expect(handler(req, response())).rejects.toThrow('audit unavailable');
    expect(dependencies.updateOperationsItem).not.toHaveBeenCalled();
  });
});
