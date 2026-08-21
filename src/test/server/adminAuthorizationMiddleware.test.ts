import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from '../../server/lib/sessionStore.js';
import { allowedRolesForAdminRequest, requiredPermissionForAdminRequest, requireAdminAuthorization } from '../../server/lib/adminAuthorizationMiddleware.js';

function request(role: AdminRole, path: string, method = 'GET') {
  return { path, method, adminSession: { adminId: 'admin-test', email: 'admin@example.test', role, createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), ip: '127.0.0.1', ua: 'test' } } as Request;
}
function responseMock() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { response: { status } as unknown as Response, status, json };
}

describe('admin authorization policy', () => {
  it('allows public authentication routes without a role check', () => {
    expect(allowedRolesForAdminRequest('/auth/login', 'POST')).toBeNull();
  });

  it('maps protected modules to explicit read and write permissions', () => {
    expect(requiredPermissionForAdminRequest('/transactions', 'GET')).toBe('transactions.view');
    expect(requiredPermissionForAdminRequest('/transactions/approve', 'POST')).toBe('transactions.approve');
    expect(requiredPermissionForAdminRequest('/kyc/aml', 'POST')).toBe('compliance.manage');
    expect(requiredPermissionForAdminRequest('/balance/adjust', 'POST')).toBe('ledger.adjust');
    expect(requiredPermissionForAdminRequest('/security/roles', 'POST')).toBe('admin.roles.manage');
  });

  it('maps authenticated session and security operations explicitly', () => {
    expect(requiredPermissionForAdminRequest('/auth/logout', 'POST')).toBe('dashboard.view');
    expect(requiredPermissionForAdminRequest('/auth/trusted-devices', 'GET')).toBe('security.view');
    expect(requiredPermissionForAdminRequest('/auth/trusted-devices', 'DELETE')).toBe('security.manage');
    expect(requiredPermissionForAdminRequest('/security/sessions', 'GET')).toBe('security.view');
    expect(requiredPermissionForAdminRequest('/security/sessions', 'PATCH')).toBe('security.manage');
  });

  it('permits finance operations but blocks finance administrators from AML decisions', async () => {
    const finance = responseMock();
    const financeNext = vi.fn() as NextFunction;
    await requireAdminAuthorization(request('FINANCE_ADMIN', '/balance/adjust', 'POST'), finance.response, financeNext);
    expect(financeNext).toHaveBeenCalledOnce();

    const compliance = responseMock();
    await requireAdminAuthorization(request('FINANCE_ADMIN', '/kyc/aml', 'POST'), compliance.response, vi.fn() as NextFunction);
    expect(compliance.status).toHaveBeenCalledWith(403);
  });

  it('blocks support administrators from ledger adjustments', async () => {
    const blocked = responseMock();
    await requireAdminAuthorization(request('SUPPORT_ADMIN', '/balance/adjust', 'POST'), blocked.response, vi.fn() as NextFunction);
    expect(blocked.status).toHaveBeenCalledWith(403);
  });

  it('reserves role changes for the super administrator', async () => {
    const blocked = responseMock();
    await requireAdminAuthorization(request('SECURITY_ADMIN', '/security/roles', 'POST'), blocked.response, vi.fn() as NextFunction);
    expect(blocked.status).toHaveBeenCalledWith(403);

    const allowed = responseMock();
    const next = vi.fn() as NextFunction;
    await requireAdminAuthorization(request('SUPER_ADMIN', '/security/roles', 'POST'), allowed.response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('fails closed for unmapped administration routes, including super-admin sessions', async () => {
    const blocked = responseMock();
    await requireAdminAuthorization(request('SUPER_ADMIN', '/future-sensitive-tool', 'POST'), blocked.response, vi.fn() as NextFunction);
    expect(blocked.status).toHaveBeenCalledWith(403);
    expect(blocked.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ADMIN_ROUTE_UNMAPPED' }));
  });
});
