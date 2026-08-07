/**
 * POST /api/admin/smartsupp/tickets
 * Actions: create, update
 */
import type { Request, Response } from 'express';
import { createTicket, updateTicket } from '../../../../lib/smartsuppStore.js';

export default function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'update') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const ticket = updateTicket(id, data);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      return res.json({ ok: true, ticket });
    }
    // default: create
    const ticket = createTicket(data);
    res.status(201).json({ ok: true, ticket });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
