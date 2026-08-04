/**
 * POST /api/users/logout
 * Invalidates the customer session token server-side.
 * Completely separate from /api/admin/auth/logout.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../lib/userStore.js';
import { appendAudit } from '../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (!token) {
    return res.status(200).json({ ok: true }); // idempotent — already logged out
  }

  const user = await findUserBySessionToken(token);

  if (user) {
    await updateUser(user.id, { sessionToken: undefined });
    appendAudit({ event: 'user_logout', userId: user.id, email: user.email, ip: req.ip ?? 'unknown' });
  }

  return res.json({ ok: true });
}
