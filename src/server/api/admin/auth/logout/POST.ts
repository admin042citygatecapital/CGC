/**
 * POST /api/admin/auth/logout
 * Deletes the server-side session and clears the HttpOnly cookie.
 * The browser session credential is accepted only from the HttpOnly cookie.
 */
import type { Request, Response } from 'express';
import { deleteSession } from '../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { COOKIE_NAME, COOKIE_PATH } from '../../../../lib/adminAuthMiddleware.js';

export default async function handler(req: Request, res: Response) {
  const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];

  if (token && token.length === 64) {
    await deleteSession(token);
    appendAudit({ event: 'logout', ip: req.ip ?? 'unknown' });
  }

  // Always clear the cookie regardless of whether a token was found
  res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });

  return res.json({ ok: true });
}
