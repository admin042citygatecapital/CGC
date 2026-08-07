/**
 * GET /api/csrf
 * Issues the double-submit token required by authenticated administrator
 * writes. The token is returned once to the SPA and also placed in a host-only,
 * HttpOnly, SameSite cookie.
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export default function handler(_req: Request, res: Response) {
  const token = crypto.randomBytes(32).toString('hex');

  res.cookie('csrf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_TTL_MS,
    path: '/',
  });

  return res.json({ csrfToken: token });
}

/** Validate a matching CSRF header/cookie pair on state-changing requests. */
export function csrfProtect(req: Request, res: Response, next: () => void) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const headerToken = req.headers['x-csrf-token'] as string | undefined;
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.csrf_token;
  if (!headerToken || !cookieToken) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  const headerBytes = Buffer.from(headerToken);
  const cookieBytes = Buffer.from(cookieToken);
  if (
    headerBytes.length !== cookieBytes.length
    || !crypto.timingSafeEqual(headerBytes, cookieBytes)
  ) {
    return res.status(403).json({ error: 'CSRF token invalid or expired' });
  }

  next();
}
