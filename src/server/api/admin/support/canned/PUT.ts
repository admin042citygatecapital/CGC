/**
 * PUT /api/admin/support/canned
 * Body: { id: string, title?: string, body?: string, category?: string }
 * Update an existing canned response.
 */
import type { Request, Response } from 'express';
import { updateCannedResponse } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { id?: string; title?: string; body?: string; category?: string };
  if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required' });

  const patch: { title?: string; body?: string; category?: string } = {};
  if (raw.title !== undefined) patch.title = sanitizeString(raw.title, 200);
  if (raw.body !== undefined) patch.body = sanitizeString(raw.body, 5000);
  if (raw.category !== undefined) patch.category = sanitizeString(raw.category, 100);

  const item = updateCannedResponse(raw.id, patch);
  if (!item) return res.status(404).json({ ok: false, error: 'Canned response not found' });

  appendAudit({
    event: 'support_canned_response_updated',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { id: raw.id },
  });

  return res.json({ ok: true, item });
}
