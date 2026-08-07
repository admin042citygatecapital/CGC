/**
 * rbacMiddleware.ts — Role-based access control middleware.
 * Use after requireAdminAuth to enforce specific roles.
 */
import type { Request, Response, NextFunction } from 'express';
import type { AdminRole } from './sessionStore.js';

/**
 * Middleware factory — only allows admins with one of the specified roles.
 * Returns 403 if the session role doesn't match.
 */
export function requireRole(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = req.adminSession;
    if (!session) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    // SUPER_ADMIN always passes
    if (session.role === 'SUPER_ADMIN' || roles.includes(session.role)) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      error:   'Unauthorized access — insufficient role',
      required: roles,
      current:  session.role,
    });
  };
}

/** Shorthand — SUPER_ADMIN only */
export const requireSuperAdmin = requireRole('SUPER_ADMIN');
