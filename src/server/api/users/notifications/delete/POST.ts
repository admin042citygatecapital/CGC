/**
 * POST /api/users/notifications/delete
 * Body: { id: string }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getNotificationsForUser, deleteNotification } from '../../../../lib/notificationStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  const { notifications } = await getNotificationsForUser(user.id);
  if (!notifications.some(n => n.id === id)) {
    return res.status(404).json({ ok: false, error: 'Notification not found' });
  }

  const ok = await deleteNotification(id);
  if (!ok) return res.status(500).json({ ok: false, error: 'Failed to delete' });

  return res.json({ ok: true });
}
