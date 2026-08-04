/**
 * DELETE /api/admin/support/canned
 * Body: { id: string }
 */
import type { Request, Response } from 'express';
import { deleteCannedResponse } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  const ok = deleteCannedResponse(id);
  if (!ok) return res.status(404).json({ ok: false, error: 'Canned response not found' });

  appendAudit({
    event: 'support_canned_response_deleted',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { id },
  });

  return res.json({ ok: true });
}
