/**
 * POST /api/admin/smartsupp/agents
 * Body: { action: 'delete', id } to remove, otherwise
 * Partial<Agent> & { id? } to create (no id) or update (id given).
 */
import type { Request, Response } from 'express';
import { upsertAgent, deleteAgent, type Agent } from '../../../../lib/smartsuppStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { action?: string; id?: string } & Partial<Agent>;

  if (raw.action === 'delete') {
    if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required to delete' });
    const ok = deleteAgent(raw.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Agent not found' });
    return res.json({ ok: true });
  }

  const agent = upsertAgent(raw);
  appendAudit({ event: 'admin_smartsupp_agent_saved', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: agent.id } });
  return res.status(201).json({ ok: true, agent });
}
