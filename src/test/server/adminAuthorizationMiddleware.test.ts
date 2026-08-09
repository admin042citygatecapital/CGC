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

  it('allows a finance administrator to access transactions', () => {
    const { response, status } = responseMock();
    const next = vi.fn() as NextFunction;
    requireAdminAuthorization(request('FINANCE_ADMIN', '/transactions', 'GET'), response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it('allows a compliance administrator to review AML and approve gated transactions', () => {
    const next = vi.fn() as NextFunction;
    const aml = responseMock();
    requireAdminAuthorization(request('COMPLIANCE_ADMIN', '/kyc/aml', 'POST'), aml.response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(aml.status).not.toHaveBeenCalled();

    const approvalNext = vi.fn() as NextFunction;
    const approval = responseMock();
    requireAdminAuthorization(request('COMPLIANCE_ADMIN', '/transactions/approve', 'POST'), approval.response, approvalNext);
    expect(approvalNext).toHaveBeenCalledOnce();
    expect(approval.status).not.toHaveBeenCalled();
  });

  it('blocks finance administrators from changing AML decisions', () => {
    const { response, status } = responseMock();
    const next = vi.fn() as NextFunction;
    requireAdminAuthorization(request('FINANCE_ADMIN', '/kyc/aml', 'POST'), response, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('blocks a support administrator from balance adjustments', () => {
    const { response, status } = responseMock();
    const next = vi.fn() as NextFunction;
    requireAdminAuthorization(request('SUPPORT_ADMIN', '/balance/adjust', 'POST'), response, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('allows operational teams to manage the shared inbox but blocks security-only admins', () => {
    for (const role of ['FINANCE_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'] as AdminRole[]) {
      const allowed = responseMock();
      const next = vi.fn() as NextFunction;
      requireAdminAuthorization(request(role, '/operations', 'POST'), allowed.response, next);
      expect(next).toHaveBeenCalledOnce();
    }
    const blocked = responseMock();
    requireAdminAuthorization(request('SECURITY_ADMIN', '/operations', 'GET'), blocked.response, vi.fn() as NextFunction);
    expect(blocked.status).toHaveBeenCalledWith(403);
  });

  it('reserves role changes for the super administrator', () => {
    const { response, status } = responseMock();
    const next = vi.fn() as NextFunction;
    requireAdminAuthorization(request('SECURITY_ADMIN', '/security/roles', 'POST'), response, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('allows the super administrator to access an unknown new route', () => {
    const { response, status } = responseMock();
    const next = vi.fn() as NextFunction;
    requireAdminAuthorization(request('SUPER_ADMIN', '/future-sensitive-tool', 'POST'), response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });
});
