/**
 * GET /api/admin/smartsupp/analytics
 */
import type { Request, Response } from 'express';
import { getAnalytics } from '../../../../lib/smartsuppStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json({ ok: true, ...getAnalytics() });
}
