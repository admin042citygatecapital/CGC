/**
 * POST /api/users/devices/revoke
 * Revoke a trusted device. In the single-session model, revoking "current" logs the user out.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { deviceId } = req.body ?? {};

  // In single-session model, revoking any device clears the session
  if (deviceId === 'current' || deviceId) {
    await updateUser(user.id, {
      sessionToken:      undefined,
      sessionCreatedAt:  undefined,
      sessionLastSeenAt: undefined,
      sessionExpiresAt:  undefined,
    } as Parameters<typeof updateUser>[1]);
  }

  return res.json({ ok: true });
}
