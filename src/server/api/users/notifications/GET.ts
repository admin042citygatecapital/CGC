/**
 * GET /api/users/notifications
 * Returns notifications for the authenticated customer.
 * Query: limit (default 20), unreadOnly (boolean)
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { getNotificationsForUser } from '../../../lib/notificationStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const limit      = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 50);
  const unreadOnly = req.query.unreadOnly === 'true';

  const result = getNotificationsForUser(user.id, { limit, unreadOnly });
  return res.json(result);
}
