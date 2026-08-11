/**
 * Central authorization policy for the administration API.
 *
 * Authentication answers "who is this?"; this middleware answers "may this
 * role access this operational area?". SUPER_ADMIN remains the only role with
 * unrestricted access. Unknown/new admin routes therefore fail closed.
 */
import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from './sessionStore.js';

const PUBLIC_ADMIN_PATHS = new Set([
  '/auth/login',
  '/auth/password-reset',
  '/auth/password-reset/confirm',
  '/auth/otp/verify',
  '/auth/unlock',
  '/auth/diag',
  '/auth/verify',
  '/zoho/oauth/callback',
]);

function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

export function allowedRolesForAdminRequest(path: string, method: string): readonly AdminRole[] | null {
  const normalizedPath = normalizePath(path);
  void method;
  if (PUBLIC_ADMIN_PATHS.has(normalizedPath)) return null;
  // A single administration authority is enforced across every protected
  // route. Historical role values remain readable only for audit integrity.
  return [];
}

export function requireAdminAuthorization(req: Request, res: Response, next: NextFunction): void {
  const allowedRoles = allowedRolesForAdminRequest(req.path, req.method);
  if (allowedRoles === null) {
    next();
    return;
  }

  const session = req.adminSession;
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (session.role === 'SUPER_ADMIN') {
    next();
    return;
  }

  res.status(403).json({
    error: 'This administration is restricted to the super-administrator.',
    code: 'SUPER_ADMIN_REQUIRED',
  });
}
