/**
 * GET /api/users/login-history
 * Returns the authenticated customer's own login history.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { getLoginHistory } from '../../../lib/loginLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const history = await getLoginHistory({ email: user.email, actor: 'user', limit });

  return res.json({ ok: true, history });
}
