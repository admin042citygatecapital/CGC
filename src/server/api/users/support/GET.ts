/**
 * GET /api/users/support
 * Returns the authenticated customer's own support conversations
 * (supportStore.ts's SupportConversation model — same store the
 * admin/support/* routes already use).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { getConversationsForUser } from '../../../lib/supportStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const conversations = getConversationsForUser(user.id);
  return res.json({ ok: true, conversations });
}
