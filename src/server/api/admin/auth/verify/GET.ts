/**
 * GET /api/admin/auth/verify
 * Validate the current session token (cookie or Bearer).
 * Does NOT enforce fingerprinting — used by the SPA on page load.
 */
import type { Request, Response } from 'express';
import { findAdminByEmail } from '../../../../lib/adminCredentials.js';
import { resolveAdminSession } from '../../../../lib/adminAuthMiddleware.js';
import { COOKIE_NAME, COOKIE_PATH } from '../../../../lib/adminAuthMiddleware.js';
import { permissionsForAdminRole } from '../../../../lib/adminAuthorizationMiddleware.js';

export default async function handler(req: Request, res: Response) {
  const session = await resolveAdminSession(req);

  if (!session) {
    // Clear stale cookie if present
    res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  const admin = await findAdminByEmail(session.email);
  if (!admin) {
    res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
    return res.status(401).json({ error: 'Admin not found' });
  }

  const permissions = await permissionsForAdminRole(admin.role);
  return res.json({
    ok:    true,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, avatar: admin.avatar, permissions },
  });
}
