/**
 * GET /api/users/devices
 * Returns the customer's trusted/active devices derived from session metadata.
 * Since we use a single-session model, we return the current session as the only device.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  // Single-session model: return current session as one device entry
  const devices = user.sessionToken ? [{
    id:          'current',
    name:        'Current Session',
    type:        'browser',
    trusted:     true,
    lastSeenAt:  user.sessionLastSeenAt ?? user.sessionCreatedAt ?? new Date().toISOString(),
    createdAt:   user.sessionCreatedAt  ?? new Date().toISOString(),
    ip:          user.lastLoginIp ?? '',
    isCurrent:   true,
  }] : [];

  return res.json({ devices });
}
