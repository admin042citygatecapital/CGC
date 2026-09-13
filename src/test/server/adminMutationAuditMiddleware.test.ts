import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const { appendAudit, appendCriticalAudit } = vi.hoisted(() => ({ appendAudit: vi.fn(), appendCriticalAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit, appendCriticalAudit }));

import { auditAdminMutation, auditAdminDenied } from '../../server/lib/adminMutationAuditMiddleware.js';

const BASE_SESSION = {
  adminId: 'admin-1', email: 'admin@example.test', role: 'SUPER_ADMIN' as const,
  createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
  ip: '127.0.0.1', ua: 'test',
};

function adminRequest(method: string, overrides: Record<string, unknown> = {}): Request {
  return {
    method,
    path: '/settings',
    originalUrl: '/api/admin/settings?ignored=true',
    ip: '127.0.0.1',
    adminSession: { ...BASE_SESSION },
    ...overrides,
  } as Request;
}

function finishableResponse(statusCode = 200) {
  let finish: (() => void) | undefined;
  const response = {
    statusCode,
    once: vi.fn((_event: string, callback: () => void) => { finish = callback; }),
    json: vi.fn(function json(_body: unknown) { return response; }),
    emitFinish() { finish?.(); },
  } as unknown as Response & { emitFinish: () => void; json: ReturnType<typeof vi.fn> };
  return response;
}

describe('admin mutation audit middleware', () => {
  it('does not create write events for safe reads', () => {
    const next = vi.fn() as NextFunction;
    const response = { once: vi.fn() } as unknown as Response;
    auditAdminMutation(adminRequest('GET'), response, next);
    expect(response.once).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('records intent before execution and metadata after an authenticated write finishes', async () => {
    appendAudit.mockClear();
    const next = vi.fn() as NextFunction;
    const response = finishableResponse(200);

    await auditAdminMutation(adminRequest('POST'), response, next);
    response.emitFinish();

    expect(next).toHaveBeenCalledOnce();
    expect(appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_api_mutation_intent', adminId: 'admin-1' }));
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_api_mutation',
      adminId: 'admin-1',
      meta: expect.objectContaining({ method: 'POST', path: '/api/admin/settings', statusCode: 200 }),
    }));
  });

  it('enriches mutation rows with role, module classification and target identity', async () => {
    appendAudit.mockClear();
    appendCriticalAudit.mockClear();
    const next = vi.fn() as NextFunction;
    const response = finishableResponse(200);
    const request = adminRequest('POST', {
      path: '/action',
      originalUrl: '/api/admin/users/action',
      body: { userId: 'usr_1a2b3c4d5e6f7a8b', action: 'suspend' },
      adminSession: { ...BASE_SESSION, role: 'COMPLIANCE_ADMIN' },
    });

    await auditAdminMutation(request, response, next);

    expect(appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_api_mutation_intent',
      target: 'users',
      targetId: 'usr_1a2b3c4d5e6f7a8b',
      meta: expect.objectContaining({ module: 'users', role: 'COMPLIANCE_ADMIN' }),
    }));
    response.emitFinish();
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      target: 'users',
      targetId: 'usr_1a2b3c4d5e6f7a8b',
      meta: expect.objectContaining({ module: 'users', role: 'COMPLIANCE_ADMIN' }),
    }));
  });

  it('extracts the target id from the URL segment after the resource', async () => {
    appendCriticalAudit.mockClear();
    const response = finishableResponse(200);
    await auditAdminMutation(adminRequest('POST', {
      path: '/applications/app_1a2b3c4d/decision',
      originalUrl: '/api/admin/applications/app_1a2b3c4d/decision',
      body: { decision: 'APPROVED' },
    }), response, vi.fn() as NextFunction);

    expect(appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ targetId: 'app_1a2b3c4d', target: 'compliance' }));
  });

  it('never stores non-id body fields in the audit row', async () => {
    appendCriticalAudit.mockClear();
    const response = finishableResponse(200);
    await auditAdminMutation(adminRequest('POST', {
      path: '/action',
      originalUrl: '/api/admin/users/action',
      body: { userId: 'usr_1a2b3c4d5e6f7a8b', reason: 'a sufficiently long rationale', password: 'secret-value' },
    }), response, vi.fn() as NextFunction);

    const payload = appendCriticalAudit.mock.calls[0][0] as { meta: Record<string, unknown>; targetId?: string };
    expect(payload.targetId).toBe('usr_1a2b3c4d5e6f7a8b');
    expect(JSON.stringify(payload.meta)).not.toContain('secret-value');
    expect(JSON.stringify(payload.meta)).not.toContain('sufficiently long');
  });
});

describe('denied admin mutation audit', () => {
  it('records a permission-denied write with method, path, status, reason and identity', () => {
    appendAudit.mockClear();
    const next = vi.fn() as NextFunction;
    const response = finishableResponse(403);
    const request = adminRequest('POST', {
      path: '/applications/app_1a2b3c4d/decision',
      originalUrl: '/api/admin/applications/app_1a2b3c4d/decision',
      body: {},
      adminSession: { ...BASE_SESSION, role: 'SUPPORT_ADMIN' },
    });

    auditAdminDenied(request, response, next);
    response.json({ error: 'Your administration role does not permit this action.', code: 'ADMIN_PERMISSION_REQUIRED' });
    response.emitFinish();

    expect(next).toHaveBeenCalledOnce();
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_api_denied',
      adminId: 'admin-1',
      email: 'admin@example.test',
      ip: '127.0.0.1',
      target: 'compliance',
      targetId: 'app_1a2b3c4d',
      reason: 'ADMIN_PERMISSION_REQUIRED',
      meta: expect.objectContaining({ method: 'POST', path: '/api/admin/applications/app_1a2b3c4d/decision', statusCode: 403, role: 'SUPPORT_ADMIN' }),
    }));
  });

  it('records unauthenticated denied writes without an admin identity', () => {
    appendAudit.mockClear();
    const response = finishableResponse(401);
    const request = { method: 'POST', path: '/users/delete', originalUrl: '/api/admin/users/delete', ip: '127.0.0.1', body: {} } as Request;

    auditAdminDenied(request, response, vi.fn() as NextFunction);
    // Mirrors requireAdminAuthorization's 401 envelope, so the captured reason
    // is the envelope's error text rather than the no-envelope fallback.
    response.json({ error: 'Authentication required' });
    response.emitFinish();

    // Sessionless denials coalesce into a pending window, so the row is not
    // written synchronously with the first attempt.
    expect(appendAudit).not.toHaveBeenCalled();

    // Expire the coalescing window and replay the same probe: the pending row
    // flushes synchronously before the fresh window begins.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 15_000 + 1);
      const replay = finishableResponse(401);
      auditAdminDenied(request, replay, vi.fn() as NextFunction);
      replay.json({ error: 'Authentication required' });
      replay.emitFinish();
    } finally {
      vi.useRealTimers();
    }

    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_api_denied',
      reason: 'Authentication required',
      meta: expect.objectContaining({ statusCode: 401, attempts: 1 }),
    }));
    const payload = appendAudit.mock.calls[0][0] as { adminId?: string; email?: string };
    expect(payload.adminId).toBeUndefined();
    expect(payload.email).toBeUndefined();
  });

  it('skips safe reads entirely', () => {
    const next = vi.fn() as NextFunction;
    const response = finishableResponse(403);
    auditAdminDenied(adminRequest('GET'), response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(response.once).not.toHaveBeenCalled();
  });

  it('leaves public bootstrap endpoints exactly as before', () => {
    const next = vi.fn() as NextFunction;
    const response = finishableResponse(403);
    auditAdminDenied(adminRequest('POST', {
      path: '/auth/login',
      originalUrl: '/api/admin/auth/login',
    }), response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(response.once).not.toHaveBeenCalled();
  });

  it('records nothing when a write finishes with a non-denied status', () => {
    appendAudit.mockClear();
    const response = finishableResponse(403);
    auditAdminDenied(adminRequest('POST', { path: '/audit', originalUrl: '/api/admin/audit' }), response, vi.fn() as NextFunction);
    expect(response.once).toHaveBeenCalledOnce();
    response.statusCode = 200;
    (response as unknown as { emitFinish: () => void }).emitFinish();
    expect(appendAudit).not.toHaveBeenCalled();
  });

  it('is best-effort: an audit write failure never throws into the guard chain', () => {
    appendAudit.mockImplementationOnce(() => { throw new Error('audit storage unavailable'); });
    const response = finishableResponse(403);
    const request = adminRequest('POST', { path: '/users/delete', originalUrl: '/api/admin/users/delete', body: {} });

    auditAdminDenied(request, response, vi.fn() as NextFunction);
    response.json({ error: 'No administration permission is mapped for this route.', code: 'ADMIN_ROUTE_UNMAPPED' });
    expect(() => (response as unknown as { emitFinish: () => void }).emitFinish()).not.toThrow();
  });
});
