/**
 * PATCH /api/admin/security/threats
 * Resolve (dismiss) a threat alert.
 * Body: { id: string }
 */
import type { Request, Response } from 'express';
import { resolveThreat } from '../../../../lib/threatDetector.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ ok: false, error: 'Threat id required' });

  const ok = await resolveThreat(id);
  if (!ok) return res.status(404).json({ ok: false, error: 'Threat not found' });

  appendAudit({ event: 'admin_threat_resolved', ip: req.ip ?? 'unknown', meta: { threatId: id } });
  return res.json({ ok: true });
}
