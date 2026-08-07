/**
 * GET /api/admin/tickets/:ticketId/replies
 * Return all admin replies for a specific ticket.
 */
import type { Request, Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';

const REPLIES_FILE = '/private/tickets/replies.jsonl';

interface Reply {
  id: string; ticketId: string; from: string;
  message: string; ip: string; ts: string;
}

export default function handler(req: Request, res: Response) {
  const { ticketId } = req.params as { ticketId?: string };
  if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

  try {
    if (!existsSync(REPLIES_FILE)) return res.json({ replies: [], total: 0 });

    const replies = readFileSync(REPLIES_FILE, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line) as Reply; } catch { return null; } })
      .filter((r): r is Reply => r !== null && r.ticketId === ticketId)
      .sort((a, b) => a.ts.localeCompare(b.ts));

    return res.json({ replies, total: replies.length });
  } catch (err) {
    console.error('admin.tickets.replies.get.error', err);
    return res.status(500).json({ error: 'Failed to load replies.' });
  }
}
