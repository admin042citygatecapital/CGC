/**
 * GET /api/admin/support/canned
 * List canned (template) responses.
 */
import type { Request, Response } from 'express';
import { readCannedResponses } from '../../../../lib/supportStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, items: readCannedResponses() });
  } catch (err) {
    console.error('[admin/support/canned GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load canned responses' });
  }
}
