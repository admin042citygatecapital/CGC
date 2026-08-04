/**
 * POST /api/admin/cms/features
 * Body: { action: 'delete', id } to remove, otherwise
 * Partial<FeatureCard> & { id? } to create (no id) or update (id given).
 */
import type { Request, Response } from 'express';
import { upsertFeatureCard, deleteFeatureCard, type FeatureCard } from '../../../../lib/cmsExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { action?: string; id?: string } & Partial<FeatureCard>;

  if (raw.action === 'delete') {
    if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required to delete' });
    const ok = deleteFeatureCard(raw.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Feature card not found' });
    return res.json({ ok: true });
  }

  const card = upsertFeatureCard(raw);
  appendAudit({ event: 'admin_cms_feature_saved', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: card.id } });
  return res.status(201).json({ ok: true, feature: card });
}
