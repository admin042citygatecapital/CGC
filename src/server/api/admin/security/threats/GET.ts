/**
 * GET /api/admin/security/threats
 * Returns threat alerts + summary.
 *
 * Query params:
 *   analyze=true  — re-run threat analysis before returning
 *   active=true   — only unresolved threats
 *   limit=50
 */
import type { Request, Response } from 'express';
import { loadThreats, analyzeThreats, threatSummary } from '../../../../lib/threatDetector.js';

export default async function handler(req: Request, res: Response) {
  const shouldAnalyze = req.query.analyze === 'true';
  const onlyActive    = req.query.active !== 'false';
  const limit         = Math.min(200, Number(req.query.limit ?? 100));

  if (shouldAnalyze) {
    await analyzeThreats(); // run fresh analysis
  }

  const [threats, summary] = await Promise.all([
    loadThreats(limit, onlyActive),
    threatSummary(),
  ]);

  return res.json({ threats, summary, total: threats.length });
}
