/**
 * PUT /api/admin/support/canned
 * Update an existing canned response.
 * Body: { id, title?, body?, category? }
 */
import type { Request, Response } from 'express';
import { updateCannedResponse } from '../../../../lib/supportDatabaseStore.js';

export default async function handler(req: Request, res: Response) {
  const { id, title, body, category } = req.body ?? {};
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });

  if (!/^cr_[a-z0-9_-]{1,80}$/i.test(String(id))) return res.status(400).json({ ok: false, error: 'invalid id' });
  if ((title && String(title).trim().length > 120) || (body && String(body).trim().length > 2_000) || (category && String(category).trim().length > 80)) {
    return res.status(400).json({ ok: false, error: 'Canned response fields exceed their permitted length' });
  }
  const item = await updateCannedResponse(String(id), {
    ...(title    ? { title:    String(title).trim()    } : {}),
    ...(body     ? { body:     String(body).trim()     } : {}),
    ...(category ? { category: String(category).trim() } : {}),
  });
  if (!item) return res.status(404).json({ ok: false, error: 'Canned response not found' });
  return res.json({ ok: true, item });
}
