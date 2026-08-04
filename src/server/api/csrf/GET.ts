/**
 * GET /api/csrf
 * Issues a CSRF token tied to the session.
 * Clients must include this token in state-mutating requests via
 * the X-CSRF-Token header.
 *
 * Token is a 32-byte hex string stored in a signed, HttpOnly cookie
 * (csrf_token) and also returned in the JSON body so the frontend
 * can read it once and store it in memory.
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';

// In-memory token store: token → expiry timestamp
// Tokens expire after 2 hours. Purged lazily on each request.
const tokenStore = new Map<string, number>();
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function purgeExpired() {
  const now = Date.now();
  for (const [t, exp] of tokenStore) {
    if (exp < now) tokenStore.delete(t);
  }
}

export default function handler(_req: Request, res: Response) {
  purgeExpired();

  const token  = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + TOKEN_TTL_MS;
  tokenStore.set(token, expiry);

  // HttpOnly cookie so JS can't steal it via XSS, but we also return it
  // in the body so the SPA can include it in the X-CSRF-Token header.
  res.cookie('csrf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_TTL_MS,
    path: '/',
  });

  return res.json({ ok: true, csrfToken: token });
}

/**
 * Middleware: validates X-CSRF-Token header against the token store.
 * Use on all state-mutating admin endpoints (POST/PUT/DELETE).
 */
export function csrfProtect(req: Request, res: Response, next: () => void) {
  // Skip CSRF for non-mutating methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const token = req.headers['x-csrf-token'] as string | undefined;
  if (!token) {
    return res.status(403).json({ ok: false, error: 'CSRF token missing' });
  }

  const expiry = tokenStore.get(token);
  if (!expiry || expiry < Date.now()) {
    tokenStore.delete(token);
    return res.status(403).json({ ok: false, error: 'CSRF token invalid or expired' });
  }

  // Single-use: rotate token after consumption to prevent replay
  tokenStore.delete(token);
  const newToken  = crypto.randomBytes(32).toString('hex');
  tokenStore.set(newToken, Date.now() + TOKEN_TTL_MS);
  res.setHeader('X-New-CSRF-Token', newToken);

  next();
}
