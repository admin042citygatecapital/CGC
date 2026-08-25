/**
 * rbacMiddleware.ts — Role-based access control middleware.
 * Use after requireAdminAuth to enforce specific roles.
 */
import type { Request, Response, NextFunction } from 'express';
import type { AdminRole } from './sessionStore.js';
import { permissionsForAdminRole } from './adminAuthorizationMiddleware.js';
import type { PermissionKey } from './securityCenterStore.js';

function rejectMissingAdminSession(res: Response): false {
  res.status(401).json({ success: false, error: 'Authentication required' });
  return false;
}

/**
 * Handler-level role guard for high-risk routes that need a stricter policy
 * than their surrounding administration module.
 */
export function authorizeAdminRole(req: Request, res: Response, ...roles: AdminRole[]): boolean {
  const session = req.adminSession;
  if (!session) return rejectMissingAdminSession(res);
  if (session.role === 'SUPER_ADMIN' || roles.includes(session.role)) return true;
  res.status(403).json({
    success: false,
    error: 'Unauthorized access — insufficient role',
    code: 'ADMIN_ROLE_REQUIRED',
    required: roles,
    current: session.role,
  });
  return false;
}

/**
 * Handler-level permission guard for protected routes outside /api/admin,
 * where the central administration authorization middleware is not mounted.
 */
export async function authorizeAdminPermission(
  req: Request,
  res: Response,
  permission: PermissionKey,
): Promise<boolean> {
  const session = req.adminSession;
  if (!session) return rejectMissingAdminSession(res);
  if (session.role === 'SUPER_ADMIN') return true;
  try {
    if ((await permissionsForAdminRole(session.role)).includes(permission)) return true;
  } catch {
    res.status(503).json({
      success: false,
      error: 'Administration authorization policy is unavailable.',
      code: 'RBAC_UNAVAILABLE',
    });
    return false;
  }
  res.status(403).json({
    success: false,
    error: 'Your administration role does not permit this action.',
    code: 'ADMIN_PERMISSION_REQUIRED',
    permission,
  });
  return false;
}

/**
 * High-risk administration actions require a recently completed administrator
 * sign-in. Administrator sessions are issued only after the OTP challenge has
 * succeeded, so a fresh session is the server-owned proof of recent step-up.
 */
export function authorizeRecentAdminStepUp(
  req: Request,
  res: Response,
  maxAgeMs = 10 * 60 * 1000,
): boolean {
  const session = req.adminSession;
  if (!session) return rejectMissingAdminSession(res);

  const createdAt = Date.parse(session.createdAt);
  const ageMs = Date.now() - createdAt;
  if (!Number.isFinite(createdAt) || ageMs < -30_000 || ageMs > maxAgeMs) {
    res.status(428).json({
      success: false,
      error: 'Recent administrator verification is required. Sign in again to continue.',
      code: 'ADMIN_STEP_UP_REQUIRED',
    });
    return false;
  }
  return true;
}

/**
 * Middleware factory — only allows admins with one of the specified roles.
 * Returns 403 if the session role doesn't match.
 */
export function requireRole(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (authorizeAdminRole(req, res, ...roles)) next();
  };
}

/** Shorthand — SUPER_ADMIN only */
export const requireSuperAdmin = requireRole('SUPER_ADMIN');
