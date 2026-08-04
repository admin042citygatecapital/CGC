/**
 * POST /api/admin/security/rate-limits
 * Body: { id, windowMs?, max?, enabled? }
 *
 * Note: this updates securityCenterStore's rate-limit *policy* document
 * only. Actual enforcement (rateLimiter.ts's checkRateLimit/isRateLimited)
 * is called with hardcoded { windowMs, max } at each individual route
 * handler today — none of them read this config. Wiring enforcement to
 * read from readRateLimits() is a separate follow-up change; until then,
 * this is a record of intended limits for the security team to review,
 * not a live control.
 */
import type { Request, Response } from 'express';
import { updateRateLimitRule } from '../../../../lib/securityCenterStore.js';
import { appendAlert } from '../../../../lib/securityCenterStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { id?: string; windowMs?: number; max?: number; enabled?: boolean };
  if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required' });

  const patch: Partial<{ windowMs: number; max: number; enabled: boolean }> = {};
  if (typeof raw.windowMs === 'number' && raw.windowMs > 0) patch.windowMs = raw.windowMs;
  if (typeof raw.max === 'number' && raw.max > 0) patch.max = raw.max;
  if (typeof raw.enabled === 'boolean') patch.enabled = raw.enabled;
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ ok: false, error: 'Provide at least one of windowMs, max, enabled' });
  }

  const rule = updateRateLimitRule(raw.id, patch);
  if (!rule) return res.status(404).json({ ok: false, error: 'Rate limit rule not found' });

  const adminId = req.adminSession?.adminId;
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';

  appendAudit({ event: 'security_rate_limit_updated', adminId, email: adminEmail, ip, meta: { id: raw.id, patch } });
  appendAlert({
    type: 'config_change', severity: 'low',
    title: `Rate limit rule updated: ${rule.label}`,
    detail: `Rule "${rule.label}" (${rule.path}) changed by ${adminEmail}.`,
    adminId, resolved: false,
  });

  return res.json({ ok: true, rule });
}
