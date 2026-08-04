/**
 * GET /api/admin/readiness
 * Real production-readiness signal, derived from envValidator's report and
 * actual DB configuration state — not a fabricated pass/fail.
 */
import type { Request, Response } from 'express';
import { buildEnvReport } from '../../../lib/envValidator.js';
import { isDatabaseConfigured } from '../../../db/db.js';
import { APP_ENV } from '../../../lib/envConfig.js';

export default async function handler(_req: Request, res: Response) {
  const envReport = buildEnvReport();
  const dbConfigured = isDatabaseConfigured();

  const checks = {
    environment: { ok: true, value: APP_ENV },
    database: { ok: dbConfigured, value: dbConfigured ? 'connected (Neon Postgres)' : 'not configured — flat-file mode' },
    criticalSecrets: { ok: envReport.summary.critical === 0, value: `${envReport.summary.critical} missing critical secret(s)` },
  };

  const ready = Object.values(checks).every(c => c.ok);

  return res.json({ ok: true, ready, checks, envSummary: envReport.summary });
}
