/**
 * POST /api/admin/smartsupp/tickets
 * Body: Partial<SupportTicket> & { id? } — creates (no id) or updates
 * (id given) a Smartsupp support ticket.
 */
import type { Request, Response } from 'express';
import { createTicket, updateTicket, type SupportTicket } from '../../../../lib/smartsuppStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { id?: string } & Partial<SupportTicket>;

  if (raw.id) {
    const { id, ...patch } = raw;
    const ticket = updateTicket(id, patch);
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket not found' });
    appendAudit({ event: 'admin_smartsupp_ticket_updated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id } });
    return res.json({ ok: true, ticket });
  }

  const ticket = createTicket(raw);
  appendAudit({ event: 'admin_smartsupp_ticket_created', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: ticket.id } });
  return res.status(201).json({ ok: true, ticket });
}
