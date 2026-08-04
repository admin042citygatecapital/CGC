/**
 * GET /api/admin/users/:id/login-history
 * Admin view of a specific customer's login history.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../../lib/userStore.js';
import { getLoginHistory } from '../../../../../lib/loginLog.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const user = await findUserById(id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const events = await getLoginHistory({ userId: id, actor: 'user', limit: 200 });
  return res.json({ ok: true, events });
}
