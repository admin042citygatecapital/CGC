/**
 * Admin authentication middleware.
 *
 * Token resolution order (dual-mode for backward compat):
 *   1. HttpOnly cookie  `cgc_admin_sid`  (preferred — XSS-safe)
 *   2. Authorization: Bearer <token>     (fallback — SPA localStorage)
 *
 * Session fingerprinting is enforced: IP + UA must match the values recorded
 * at login. A mismatch returns 401 so the client re-authenticates.
 *
 * Attaches `req.adminSession` and `req.adminToken` for downstream handlers.
 */
import type { Request, Response, NextFunction } from 'express';
import { getSession, type Session } from './sessionStore.js';

// Augment Express Request so downstream handlers can read the session
declare module 'express-serve-static-core' {
  interface Request {
    adminSession?: Session;
    adminToken?:   string;
  }
}

export const COOKIE_NAME = 'cgc_admin_sid';

/** Cookie options — HttpOnly, Secure (prod), SameSite=Strict */
export function sessionCookieOptions(maxAgeMs: number) {
  return {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === 'production',
    sameSite:  'strict' as const,
    // Express's maxAge is milliseconds.  Passing seconds here silently turns
    // an eight-hour session into a roughly 29-second cookie.
    maxAge:    maxAgeMs,
    path:      '/api/admin',
  };
}

/** Resolve the raw token from cookie or Authorization header */
function resolveToken(req: Request): string | null {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
  if (cookie && cookie.length === 64) return cookie;

  const authorization = req.headers.authorization ?? '';
  if (authorization.startsWith('Bearer ')) {
    const bearer = authorization.slice(7).trim();
    if (/^[a-f0-9]{64}$/i.test(bearer)) return bearer;
  }

  return null;
}

/**
 * Express middleware — validates the admin session.
 * Returns 401 JSON on failure; calls next() on success.
 */
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = resolveToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const ip = req.ip ?? 'unknown';
  const ua = req.headers['user-agent'] ?? '';

  const session = await getSession(token, { ip, ua });
  if (!session) {
    // Clear stale cookie if present
    res.clearCookie(COOKIE_NAME, { path: '/api/admin' });
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }

  req.adminSession = session;
  req.adminToken   = token;
  next();
}

/**
 * Lightweight variant — reads the session WITHOUT fingerprint enforcement.
 * Used by the /verify endpoint where the client is just checking if the
 * token is still valid (no IP/UA available at that point).
 */
export async function resolveAdminSession(req: Request): Promise<Session | null> {
  const token = resolveToken(req);
  if (!token) return null;
  const ip = req.ip ?? 'unknown';
  const ua = req.headers['user-agent'] ?? '';
  return getSession(token, { ip, ua });
}
