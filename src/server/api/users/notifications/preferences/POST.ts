/**
 * POST /api/users/notifications/preferences
 * Body: Partial<{ email, sms, push, marketing }> — booleans, merged onto
 * the existing preferences.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const KEYS = ['email', 'sms', 'push', 'marketing'] as const;

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const raw = req.body as Record<string, unknown>;
  const current = (user.notificationPrefs && typeof user.notificationPrefs === 'object')
    ? (user.notificationPrefs as Record<string, unknown>)
    : {};

  const next = { ...current };
  let changed = 0;
  for (const key of KEYS) {
    if (typeof raw[key] === 'boolean') { next[key] = raw[key]; changed++; }
  }
  if (changed === 0) {
    return res.status(400).json({ ok: false, error: `Provide at least one boolean for: ${KEYS.join(', ')}` });
  }

  await updateUser(user.id, { notificationPrefs: next } as never);
  appendAudit({ event: 'user_notification_prefs_updated', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { fields: Object.keys(next) } });

  return res.json({ ok: true, preferences: next });
}
