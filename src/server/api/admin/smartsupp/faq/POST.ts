/**
 * POST /api/admin/smartsupp/faq
 * Actions: upsert, delete
 */
import type { Request, Response } from 'express';
import { upsertFaq, deleteFaq, UnsupportedFaqClaimError } from '../../../../lib/smartsuppStore.js';

export default function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const ok = deleteFaq(id);
      return res.json({ ok });
    }
    const entry = upsertFaq({ id, ...data });
    res.json({ ok: true, entry });
  } catch (err) {
    if (err instanceof UnsupportedFaqClaimError) {
      return res.status(400).json({ error: err.message, code: 'UNSUPPORTED_FINANCIAL_CLAIM' });
    }
    res.status(500).json({ error: String(err) });
  }
}
