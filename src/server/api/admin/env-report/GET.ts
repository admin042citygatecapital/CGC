/**
 * GET /api/admin/env-report
 * Returns the full environment variable validation report.
 * Admin auth required (enforced by global middleware in entry.ts).
 */
import type { Request, Response } from 'express';
import { buildEnvReport } from '../../../lib/envValidator.js';

export default function handler(_req: Request, res: Response): void {
  const report = buildEnvReport();
  res.json({ ok: true, report });
}
