/**
 * POST /api/admin/tickets/:ticketId/reply
 * Append an admin reply to a support ticket.
 * Body: { message: string }
 */
import type { Request, Response } from 'express';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { appendAudit } from '../../../../lib/auditLog.js';
import { privateSubdirectory } from '../../../../lib/storagePaths.js';

const STORE_DIR  = privateSubdirectory('tickets');
const REPLIES_FILE = join(STORE_DIR, 'replies.jsonl');

export default function handler(req: Request, res: Response) {
  try {
    const { ticketId } = req.params as { ticketId?: string };
    const { message } = req.body as { message?: string };

    if (!ticketId) return res.status(400).json({ error: 'Ticket ID is required.' });
    if (!message?.trim()) return res.status(400).json({ error: 'Reply message is required.' });
    if (message.trim().length > 10_000) return res.status(400).json({ error: 'Reply is too long.' });

    const reply = {
      id:       `reply_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ticketId,
      from:     'admin',
      message:  message.trim(),
      ip:       req.ip ?? 'unknown',
      ts:       new Date().toISOString(),
    };

    mkdirSync(STORE_DIR, { recursive: true });
    appendFileSync(REPLIES_FILE, JSON.stringify(reply) + '\n', 'utf-8');

    appendAudit({
      event: 'admin_ticket_reply',
      ip: req.ip ?? 'unknown',
      meta: { ticketId, replyId: reply.id },
    });

    return res.status(201).json({ ok: true, reply });
  } catch (err) {
    console.error('admin.tickets.reply.error', err);
    return res.status(500).json({ error: 'Failed to send reply.' });
  }
}
