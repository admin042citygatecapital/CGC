/**
 * POST /api/admin/support/canned
 * Body: { title: string, body: string, category: string }
 * Create a new canned response.
 */
import type { Request, Response } from 'express';
import { createCannedResponse } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { title?: string; body?: string; category?: string };
  const title = sanitizeString(raw.title, 200);
  const body = sanitizeString(raw.body, 5000);
  const category = sanitizeString(raw.category, 100) || 'General';

  if (!title || !body) {
    return res.status(400).json({ ok: false, error: 'title and body are required' });
  }

  const item = createCannedResponse({ title, body, category });

  appendAudit({
    event: 'support_canned_response_created',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { id: item.id },
  });

  return res.status(201).json({ ok: true, item });
}
