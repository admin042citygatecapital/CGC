/**
 * POST /api/admin/security/rate-limits
 * Body: { id: string; windowMs?: number; max?: number; enabled?: boolean }
 */
import type { Request, Response } from 'express';
import { updateRateLimitRule } from '../../../../lib/securityCenterStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { id, windowMs, max, enabled } =
      req.body as { id: string; windowMs?: number; max?: number; enabled?: boolean };
    if (!id) return res.status(400).json({ error: 'id required' });
    const updated = updateRateLimitRule(id, { windowMs, max, enabled });
    if (!updated) return res.status(404).json({ error: 'Rule not found' });
    res.json({ ok: true, rule: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update rate limit', message: String(err) });
  }
}
