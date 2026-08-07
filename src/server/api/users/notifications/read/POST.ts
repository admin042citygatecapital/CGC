/**
 * POST /api/users/notifications/read
 * Mark one or all notifications as read.
 * Body: { notificationId?: string } — omit to mark all read.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { markAsRead, markAllReadForUser } from '../../../../lib/notificationStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { notificationId } = req.body ?? {};

  if (notificationId) {
    markAsRead(String(notificationId));
    return res.json({ ok: true });
  }

  const count = markAllReadForUser(user.id);
  return res.json({ ok: true, marked: count });
}
