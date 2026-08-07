/**
 * GET /api/users/security/sessions
 * Returns active sessions for the customer.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const sessions = user.sessionToken ? [{
    id:          'sess_current',
    description: 'Current session',
    createdAt:   user.sessionCreatedAt  ?? new Date().toISOString(),
    lastSeenAt:  user.sessionLastSeenAt ?? new Date().toISOString(),
    expiresAt:   user.sessionExpiresAt  ?? '',
    ip:          user.lastLoginIp ?? '',
    isCurrent:   true,
  }] : [];

  return res.json({ sessions });
}
