/**
 * GET /api/admin/auth/verify
 * Validate the current session token (cookie or Bearer).
 * Does NOT enforce fingerprinting — used by the SPA on page load.
 */
import type { Request, Response } from 'express';
import { findAdminByEmail } from '../../../../lib/adminCredentials.js';
import { resolveAdminSession } from '../../../../lib/adminAuthMiddleware.js';
import { COOKIE_NAME, COOKIE_PATH } from '../../../../lib/adminAuthMiddleware.js';

export default async function handler(req: Request, res: Response) {
  const session = await resolveAdminSession(req);

  if (!session) {
    // Clear stale cookie if present
    res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  const admin = findAdminByEmail(session.email);
  if (!admin) {
    res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
    return res.status(401).json({ error: 'Admin not found' });
  }

  return res.json({
    ok:    true,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: 'SUPER_ADMIN', avatar: admin.avatar },
  });
}
