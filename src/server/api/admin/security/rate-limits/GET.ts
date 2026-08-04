/**
 * GET /api/admin/security/rate-limits
 * Per-endpoint rate limit configuration (informational/policy — the actual
 * enforcement in rateLimiter.ts/entry.ts is hardcoded per call site today;
 * see the POST handler's note).
 */
import type { Request, Response } from 'express';
import { readRateLimits } from '../../../../lib/securityCenterStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, rules: readRateLimits() });
  } catch (err) {
    console.error('[admin/security/rate-limits GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load rate limit rules' });
  }
}
