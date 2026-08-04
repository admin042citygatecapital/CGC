/**
 * GET /api/admin/env-report
 * Real environment/secrets configuration report (envValidator.ts) — never
 * exposes actual secret values, only presence/masked status.
 */
import type { Request, Response } from 'express';
import { buildEnvReport } from '../../../lib/envValidator.js';

export default async function handler(_req: Request, res: Response) {
  return res.json({ ok: true, report: buildEnvReport() });
}
