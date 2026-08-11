import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from '../../server/lib/sessionStore.js';
import {
  allowedRolesForAdminRequest,
  requireAdminAuthorization,
} from '../../server/lib/adminAuthorizationMiddleware.js';

function request(role: AdminRole, path: string, method = 'GET') {
  return {
    path,
    method,
    adminSession: {
      adminId: 'admin-test', email: 'admin@example.test', role,
      createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
      ip: '127.0.0.1', ua: 'test',
    },
  } as Request;
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

  it('blocks every retired administrator role across all protected areas', () => {
    const paths = ['/transactions', '/kyc/aml', '/operations', '/support/complaints', '/security', '/users'];
    for (const role of ['FINANCE_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'] as AdminRole[]) {
      for (const path of paths) {
        const blocked = responseMock();
        const next = vi.fn() as NextFunction;
        requireAdminAuthorization(request(role, path, 'POST'), blocked.response, next);
        expect(next).not.toHaveBeenCalled();
        expect(blocked.status).toHaveBeenCalledWith(403);
      }
    }
  });

  it('blocks finance administrators from changing AML decisions', () => {
    const { response, status } = responseMock();
    const next = vi.fn() as NextFunction;
    requireAdminAuthorization(request('FINANCE_ADMIN', '/kyc/aml', 'POST'), response, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('reserves final registration approval and application denial for super administrators', () => {
    for (const role of ['FINANCE_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'] as AdminRole[]) {
      for (const path of ['/users/approve', '/users/reject']) {
        const blocked = responseMock();
        requireAdminAuthorization(request(role, path, 'POST'), blocked.response, vi.fn() as NextFunction);
        expect(blocked.status).toHaveBeenCalledWith(403);
      }
    }
    for (const path of ['/users/approve', '/users/reject']) {
      const allowed = responseMock();
      const next = vi.fn() as NextFunction;
      requireAdminAuthorization(request('SUPER_ADMIN', path, 'POST'), allowed.response, next);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it('blocks a support administrator from balance adjustments', () => {
    const { response, status } = responseMock();
    const next = vi.fn() as NextFunction;
    requireAdminAuthorization(request('SUPPORT_ADMIN', '/balance/adjust', 'POST'), response, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('reserves role changes for the super administrator', () => {
    const { response, status } = responseMock();
    const next = vi.fn() as NextFunction;
    requireAdminAuthorization(request('SECURITY_ADMIN', '/security/roles', 'POST'), response, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('reserves public social publishing for the super administrator', () => {
    for (const role of ['FINANCE_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'] as AdminRole[]) {
      const blocked = responseMock();
      requireAdminAuthorization(request(role, '/social/share', 'POST'), blocked.response, vi.fn() as NextFunction);
      expect(blocked.status).toHaveBeenCalledWith(403);
    }
  });

  it('allows the super administrator to access an unknown new route', () => {
    const { response, status } = responseMock();
    const next = vi.fn() as NextFunction;
    requireAdminAuthorization(request('SUPER_ADMIN', '/future-sensitive-tool', 'POST'), response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });
});
