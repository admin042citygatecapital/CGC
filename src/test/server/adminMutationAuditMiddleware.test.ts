import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const { appendAudit } = vi.hoisted(() => ({ appendAudit: vi.fn() }));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit }));

import { auditAdminMutation } from '../../server/lib/adminMutationAuditMiddleware.js';

function adminRequest(method: string): Request {
  return {
    method,
    path: '/settings',
    originalUrl: '/api/admin/settings?ignored=true',
    ip: '127.0.0.1',
    adminSession: {
      adminId: 'admin-1', email: 'admin@example.test', role: 'SUPER_ADMIN',
      createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
      ip: '127.0.0.1', ua: 'test',
    },
  } as Request;
}

describe('admin mutation audit middleware', () => {
  it('does not create write events for safe reads', () => {
    const next = vi.fn() as NextFunction;
    const response = { once: vi.fn() } as unknown as Response;
    auditAdminMutation(adminRequest('GET'), response, next);
    expect(response.once).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('records metadata after an authenticated write finishes', () => {
    appendAudit.mockClear();
    const next = vi.fn() as NextFunction;
    let finish: (() => void) | undefined;
    const response = {
      statusCode: 200,
      once: vi.fn((_event: string, callback: () => void) => { finish = callback; }),
    } as unknown as Response;

    auditAdminMutation(adminRequest('POST'), response, next);
    finish?.();

    expect(next).toHaveBeenCalledOnce();
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_api_mutation',
      adminId: 'admin-1',
      meta: expect.objectContaining({ method: 'POST', path: '/api/admin/settings', statusCode: 200 }),
    }));
  });
});
