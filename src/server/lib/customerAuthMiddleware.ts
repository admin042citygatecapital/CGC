/**
 * Customer authentication middleware.
 *
 * Token resolution: Secure, HttpOnly `cgc_customer_sid` cookie.
 *   - Browser JavaScript never receives the customer session credential.
 *   - The token is validated against the persistent user store (userStore.ts).
 *   - TTL enforcement (60-min inactivity + 8-hr absolute) is handled inside
 *     findUserBySessionToken — this middleware just calls it and gates the request.
 *
 * Applied as:  app.use('/api/users', requireCustomerAuth)
 *   - Covers all /api/users/* routes automatically.
 *   - Public customer routes (/api/users/register, /api/users/login,
 *     /api/users/verify-email, /api/users/password-reset*) are registered
 *     BEFORE the blanket middleware so they are never intercepted.
 *
 * Attaches `req.customerUser` (UserRecord) for downstream handlers.
 * Downstream handlers that previously extracted the token themselves still work —
 * they can call findUserBySessionToken again (idempotent) or read req.customerUser.
 */
import type { Request, Response, NextFunction } from 'express';
import { findUserBySessionToken, type UserRecord } from './userStore.js';
import {
  CUSTOMER_SESSION_COOKIE,
  clearCustomerSessionCookie,
} from './customerSessionConfig.js';

// Augment Express Request so downstream handlers can read the attached user
declare module 'express-serve-static-core' {
  interface Request {
    customerUser?: UserRecord;
    customerToken?: string;
  }
}

/** Resolve the raw credential from the host-only customer session cookie. */
export function resolveCustomerSessionToken(req: Request): string | null {
  const token = (req.cookies as Record<string, string> | undefined)?.[CUSTOMER_SESSION_COOKIE] ?? '';
  return /^[a-f0-9]{64}$/i.test(token) ? token : null;
}

function expectedOrigin(req: Request): string | null {
  try {
    const configuredUrl = process.env.PUBLIC_URL ?? process.env.APP_URL ?? process.env.VITE_PUBLIC_URL;
    if (configuredUrl) return new URL(configuredUrl).origin;
    const host = req.get('host');
    return host ? `${req.protocol}://${host}` : null;
  } catch {
    return null;
  }
}

/** Cookie-authenticated customer writes must originate from this exact site. */
export function requireCustomerSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const expected = expectedOrigin(req);
  const supplied = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  if (!expected || supplied !== expected || (fetchSite && fetchSite !== 'same-origin')) {
    res.status(403).json({ error: 'Same-origin customer request required', code: 'CUSTOMER_CSRF_REJECTED' });
    return;
  }
  next();
}

/**
 * Express middleware — validates the customer session.
 * Returns 401 JSON on failure; calls next() on success.
 * Attaches the resolved UserRecord to req.customerUser.
 */
export async function requireCustomerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = resolveCustomerSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // findUserBySessionToken enforces inactivity + absolute TTL and auto-clears
  // expired tokens — no additional TTL logic needed here.
  const user = await findUserBySessionToken(token);
  if (!user) {
    clearCustomerSessionCookie(res);
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }

  req.customerUser = user;
  req.customerToken = token;
  // Compatibility bridge for legacy handlers while central authentication is
  // adopted throughout the route tree. This value exists server-side only and
  // is never returned to browser JavaScript.
  req.headers.authorization = `Bearer ${token}`;
  next();
}
