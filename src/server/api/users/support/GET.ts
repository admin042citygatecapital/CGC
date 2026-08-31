/**
 * GET /api/users/support
 * Returns the authenticated customer's support conversations.
 */
import type { Request, Response } from 'express';
import { isDatabaseConfigured } from '../../../db/db.js';
import { getConversationsForUser } from '../../../lib/supportDatabaseStore.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!isDatabaseConfigured()) {
    return res.status(503).json({
      error: 'Support history is temporarily unavailable.',
      code: 'SUPPORT_STORAGE_UNAVAILABLE',
    });
  }

  try {
    const conversations = await getConversationsForUser(user.id);
    return res.json({ conversations });
  } catch {
    return res.status(503).json({
      error: 'Support history is temporarily unavailable.',
      code: 'SUPPORT_STORAGE_UNAVAILABLE',
    });
  }
}
