/**
 * Customer authentication middleware.
 *
 * Token resolution: Authorization: Bearer <token>
 *   - Customers authenticate via a 64-hex Bearer token stored in localStorage.
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

// Augment Express Request so downstream handlers can read the attached user
declare module 'express-serve-static-core' {
  interface Request {
    customerUser?: UserRecord;
  }
}

/** Resolve the raw Bearer token from the Authorization header */
function resolveToken(req: Request): string | null {
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  // Customer tokens are 64 hex chars (32 random bytes)
  return /^[a-f0-9]{64}$/i.test(token) ? token : null;
}

/**
 * Express middleware — validates the customer session.
 * Returns 401 JSON on failure; calls next() on success.
 * Attaches the resolved UserRecord to req.customerUser.
 */
export async function requireCustomerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = resolveToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // findUserBySessionToken enforces inactivity + absolute TTL and auto-clears
  // expired tokens — no additional TTL logic needed here.
  const user = await findUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }

  req.customerUser = user;
  next();
}
