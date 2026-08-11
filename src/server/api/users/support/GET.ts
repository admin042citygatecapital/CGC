/**
 * GET /api/users/support
 * Returns the authenticated customer's support conversations.
 */
import type { Request, Response } from 'express';
import { getConversationsForUser } from '../../../lib/supportStore.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const conversations = getConversationsForUser(user.id);
  return res.json({ conversations });
}
