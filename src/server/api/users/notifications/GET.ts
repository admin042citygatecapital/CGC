/**
 * GET /api/users/notifications
 * Query: limit?, unreadOnly?
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { getNotificationsForUser } from '../../../lib/notificationStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const q = req.query as { limit?: string; unreadOnly?: string };
  const { notifications, unreadCount } = await getNotificationsForUser(user.id, {
    limit: q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)) : undefined,
    unreadOnly: q.unreadOnly === 'true',
  });

  return res.json({ ok: true, notifications, unreadCount });
}
