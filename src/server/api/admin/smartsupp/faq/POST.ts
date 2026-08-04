/**
 * POST /api/admin/smartsupp/faq
 * Body: { action: 'delete', id } to remove, otherwise
 * Partial<FaqEntry> & { id? } to create (no id) or update (id given).
 */
import type { Request, Response } from 'express';
import { upsertFaq, deleteFaq, type FaqEntry } from '../../../../lib/smartsuppStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { action?: string; id?: string } & Partial<FaqEntry>;

  if (raw.action === 'delete') {
    if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required to delete' });
    const ok = deleteFaq(raw.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'FAQ entry not found' });
    return res.json({ ok: true });
  }

  const entry = upsertFaq(raw);
  appendAudit({ event: 'admin_smartsupp_faq_saved', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: entry.id } });
  return res.status(201).json({ ok: true, entry });
}
