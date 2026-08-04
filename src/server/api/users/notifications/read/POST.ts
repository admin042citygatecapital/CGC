/**
 * POST /api/users/notifications/read
 * Body: { id?: string } — marks one notification read, or (if id omitted)
 * marks all of the authenticated customer's notifications read.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getNotificationsForUser, markAsRead, markAllReadForUser } from '../../../../lib/notificationStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { id } = req.body as { id?: string };

  if (!id) {
    const count = await markAllReadForUser(user.id);
    return res.json({ ok: true, updated: count });
  }

  const { notifications } = await getNotificationsForUser(user.id);
  if (!notifications.some(n => n.id === id)) {
    return res.status(404).json({ ok: false, error: 'Notification not found' });
  }

  const ok = await markAsRead(id);
  if (!ok) return res.status(500).json({ ok: false, error: 'Failed to mark as read' });

  return res.json({ ok: true });
}
