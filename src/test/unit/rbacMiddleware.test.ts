/**
 * rbacMiddleware.ts unit tests — City Gate Capital
 *
 * Covers the actual route-level authorization mechanism used throughout
 * entry.ts (requireRole/requireSuperAdmin). Note: this is deliberately
 * distinct from securityCenterStore.ts's PermissionKey/Role.permissions
 * catalogue, which is display/editing-only for the admin "Roles &
 * Permissions" screen and is never consulted by requireRole — real
 * authorization is entirely role-name-based, which is exactly what these
 * tests verify.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireRole, requireSuperAdmin } from '../../server/lib/rbacMiddleware.js';
import type { AdminRole } from '../../server/lib/sessionStore.js';

function mockReq(role?: AdminRole): Request {
  return (role
    ? { adminSession: { adminId: 'admin_1', email: 'a@example.com', role, createdAt: '', lastSeenAt: '', ip: '', ua: '' } }
    : {}) as unknown as Request;
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('rbacMiddleware', () => {
  describe('requireRole', () => {
    it('rejects with 401 when there is no admin session', () => {
      const mw = requireRole('FINANCE_ADMIN');
      const res = mockRes();
      const next = vi.fn();
      mw(mockReq(undefined), res, next as NextFunction);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('allows a session whose role is in the allowed list', () => {
      const mw = requireRole('FINANCE_ADMIN', 'COMPLIANCE_ADMIN');
      const res = mockRes();
      const next = vi.fn();
      mw(mockReq('FINANCE_ADMIN'), res, next as NextFunction);
      expect(next).toHaveBeenCalledOnce();
    });

    it('rejects with 403 a session whose role is not in the allowed list', () => {
      const mw = requireRole('COMPLIANCE_ADMIN');
      const res = mockRes();
      const next = vi.fn();
      mw(mockReq('SUPPORT_ADMIN'), res, next as NextFunction);
      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
      expect((res.body as { current?: string }).current).toBe('SUPPORT_ADMIN');
    });

    it('always allows SUPER_ADMIN regardless of the required role list', () => {
      const mw = requireRole('COMPLIANCE_ADMIN');
      const res = mockRes();
      const next = vi.fn();
      mw(mockReq('SUPER_ADMIN'), res, next as NextFunction);
      expect(next).toHaveBeenCalledOnce();
    });

    it('does not grant a role access to a route it is not listed for (no cross-role escalation)', () => {
      // FINANCE_ADMIN is gated to trading/rates in entry.ts — verify a
      // security-sensitive role like SECURITY_ADMIN is NOT let through.
      const mw = requireRole('FINANCE_ADMIN');
      const res = mockRes();
      const next = vi.fn();
      mw(mockReq('SECURITY_ADMIN'), res, next as NextFunction);
      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireSuperAdmin', () => {
    it('allows SUPER_ADMIN', () => {
      const res = mockRes();
      const next = vi.fn();
      requireSuperAdmin(mockReq('SUPER_ADMIN'), res, next as NextFunction);
      expect(next).toHaveBeenCalledOnce();
    });

    it('rejects every non-SUPER_ADMIN role', () => {
      const roles: AdminRole[] = ['FINANCE_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'];
      for (const role of roles) {
        const res = mockRes();
        const next = vi.fn();
        requireSuperAdmin(mockReq(role), res, next as NextFunction);
        expect(res.statusCode, `role ${role} should be rejected`).toBe(403);
        expect(next).not.toHaveBeenCalled();
      }
    });
  });
});
