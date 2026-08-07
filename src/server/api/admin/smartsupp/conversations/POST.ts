/**
 * POST /api/admin/smartsupp/conversations
 * Actions: assign, resolve, takeover, add_message, rate, tag
 */
import type { Request, Response } from 'express';
import {
  updateConversation,
  addMessage,
} from '../../../../lib/smartsuppStore.js';

export default function handler(req: Request, res: Response) {
  const { action, id, agentId, message, role, rating, tags, status } = req.body ?? {};

  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    let result;
    switch (action) {
      case 'assign':
        result = updateConversation(id, { assignedAgentId: agentId, status: 'assigned' });
        break;
      case 'resolve':
        result = updateConversation(id, { status: 'resolved', resolvedAt: new Date().toISOString() });
        break;
      case 'reopen':
        result = updateConversation(id, { status: 'open', resolvedAt: null });
        break;
      case 'takeover':
        result = updateConversation(id, { assignedAgentId: agentId ?? 'admin', status: 'assigned' });
        break;
      case 'add_message':
        result = addMessage(id, { role: role ?? 'agent', text: message ?? '', agentId });
        break;
      case 'rate':
        result = updateConversation(id, { rating: Number(rating) });
        break;
      case 'tag':
        result = updateConversation(id, { tags: Array.isArray(tags) ? tags : [tags] });
        break;
      case 'status':
        result = updateConversation(id, { status });
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
    if (!result) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ ok: true, conversation: result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
