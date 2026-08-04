/**
 * GET /api/users/notifications/preferences
 * Returns the authenticated customer's own notification preferences
 * (UserRecord.notificationPrefs — an opaque JSON field, no dedicated store).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';

const DEFAULT_PREFS = { email: true, sms: false, push: true, marketing: false };

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const prefs = (user.notificationPrefs && typeof user.notificationPrefs === 'object')
    ? { ...DEFAULT_PREFS, ...(user.notificationPrefs as Record<string, unknown>) }
    : DEFAULT_PREFS;

  return res.json({ ok: true, preferences: prefs });
}
