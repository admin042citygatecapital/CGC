/**
 * DELETE /api/admin/support/canned
 * Delete a canned response.
 * Body: { id }
 */
import type { Request, Response } from 'express';
import { deleteCannedResponse } from '../../../../lib/supportDatabaseStore.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });

  if (!/^cr_[a-z0-9_-]{1,80}$/i.test(String(id))) return res.status(400).json({ ok: false, error: 'invalid id' });
  const ok = await deleteCannedResponse(String(id));
  if (!ok) return res.status(404).json({ ok: false, error: 'Canned response not found' });
  return res.json({ ok: true });
}
