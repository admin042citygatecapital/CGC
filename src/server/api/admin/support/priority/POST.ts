/**
 * POST /api/admin/support/priority
 * Update priority of a single ticket.
 * Body: { conversationId, priority }
 */
import type { Request, Response } from 'express';
import { updateConversationPriority } from '../../../../lib/supportDatabaseStore.js';
import type { SupportConversation } from '../../../../lib/supportDatabaseStore.js';

export default async function handler(req: Request, res: Response) {
  const { conversationId, priority } = req.body ?? {};
  if (!conversationId) return res.status(400).json({ ok: false, error: 'conversationId required' });
  const valid = ['low', 'medium', 'high', 'urgent'];
  if (!valid.includes(String(priority))) return res.status(400).json({ ok: false, error: 'invalid priority' });

  const ok = await updateConversationPriority(String(conversationId), priority as SupportConversation['priority']);
  if (!ok) return res.status(404).json({ ok: false, error: 'Ticket not found' });
  return res.json({ ok: true });
}
