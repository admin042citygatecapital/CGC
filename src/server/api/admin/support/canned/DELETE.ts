/**
 * DELETE /api/admin/support/canned
 * Delete a canned response.
 * Body: { id }
 */
import type { Request, Response } from 'express';
import { deleteCannedResponse } from '../../../../lib/supportStore.js';

export default function handler(req: Request, res: Response) {
  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });

  const ok = deleteCannedResponse(String(id));
  if (!ok) return res.status(404).json({ ok: false, error: 'Canned response not found' });
  return res.json({ ok: true });
}
