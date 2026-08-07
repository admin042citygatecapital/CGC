/**
 * PUT /api/admin/support/canned
 * Update an existing canned response.
 * Body: { id, title?, body?, category? }
 */
import type { Request, Response } from 'express';
import { updateCannedResponse } from '../../../../lib/supportStore.js';

export default function handler(req: Request, res: Response) {
  const { id, title, body, category } = req.body ?? {};
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });

  const item = updateCannedResponse(String(id), {
    ...(title    ? { title:    String(title).trim()    } : {}),
    ...(body     ? { body:     String(body).trim()     } : {}),
    ...(category ? { category: String(category).trim() } : {}),
  });
  if (!item) return res.status(404).json({ ok: false, error: 'Canned response not found' });
  return res.json({ ok: true, item });
}
