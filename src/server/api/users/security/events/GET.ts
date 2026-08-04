/**
 * GET /api/users/security/events
 * Returns the authenticated customer's own security-relevant events —
 * currently their login history (success/failed/blocked attempts), the
 * same underlying data users/login-history exposes, filtered/labeled for
 * a security-center-style view.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getLoginHistory } from '../../../../lib/loginLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const events = await getLoginHistory({ email: user.email, actor: 'user', limit });

  return res.json({ ok: true, events });
}
