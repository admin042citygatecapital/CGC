/**
 * POST /api/admin/support/routing
 * Body: { rules: Array<{ id: string, category: string, assignTo: string, enabled: boolean }> }
 * Replace the category → team auto-assignment routing rules.
 */
import type { Request, Response } from 'express';
import { writeRoutingConfig, type RoutingRule } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const { rules } = req.body as { rules?: unknown };
  if (!Array.isArray(rules)) {
    return res.status(400).json({ ok: false, error: 'rules must be an array' });
  }

  const safeRules: RoutingRule[] = [];
  for (const r of rules) {
    if (!r || typeof r !== 'object') continue;
    const rule = r as Record<string, unknown>;
    const id = typeof rule.id === 'string' && rule.id ? rule.id : `rr_${safeRules.length + 1}`;
    const category = sanitizeString(rule.category, 100);
    const assignTo = sanitizeString(rule.assignTo, 100);
    if (!category || !assignTo) continue;
    safeRules.push({ id, category, assignTo, enabled: rule.enabled !== false });
  }

  const config = { rules: safeRules, updatedAt: new Date().toISOString() };
  writeRoutingConfig(config);

  appendAudit({
    event: 'support_routing_config_updated',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { ruleCount: safeRules.length },
  });

  return res.json({ ok: true, config });
}
