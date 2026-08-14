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
    if (!id || !/^rl_[a-z0-9_]{2,80}$/.test(id)) return res.status(400).json({ error: 'Valid rule id required' });
    if (windowMs !== undefined && (!Number.isInteger(windowMs) || windowMs < 1_000 || windowMs > 86_400_000)) {
      return res.status(400).json({ error: 'windowMs must be an integer between 1000 and 86400000' });
    }
    if (max !== undefined && (!Number.isInteger(max) || max < 1 || max > 10_000)) {
      return res.status(400).json({ error: 'max must be an integer between 1 and 10000' });
    }
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    const adminEmail = req.adminSession?.email ?? 'admin';
    const updated = await updateRateLimitRule(id, { windowMs, max, enabled }, adminEmail);
    if (!updated) return res.status(404).json({ error: 'Rule not found' });
    res.json({ ok: true, rule: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update rate limit' });
  }
}
