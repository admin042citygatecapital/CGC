/**
 * GET /api/admin/support/stats
 * Returns dashboard stats: open, pending, resolved today, avg response time, oldest unresolved.
 */
import type { Request, Response } from 'express';
import { getSupportStats } from '../../../../lib/supportDatabaseStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json(await getSupportStats());
}
