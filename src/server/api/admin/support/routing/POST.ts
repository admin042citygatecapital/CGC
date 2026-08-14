/**
 * POST /api/admin/support/routing
 * Save auto-assignment routing rules.
 * Body: { rules: RoutingRule[] }
 */
import type { Request, Response } from 'express';
import { writeRoutingConfig } from '../../../../lib/supportDatabaseStore.js';
import type { RoutingConfig, RoutingRule } from '../../../../lib/supportDatabaseStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { rules } = req.body ?? {};
  if (!Array.isArray(rules)) return res.status(400).json({ ok: false, error: 'rules array required' });
  if (rules.length > 50) return res.status(400).json({ ok: false, error: 'A maximum of 50 routing rules is allowed' });

  const safeRules: RoutingRule[] = [];
  for (const rule of rules) {
    const id = String(rule?.id ?? '').trim();
    const category = String(rule?.category ?? '').trim();
    const assignTo = String(rule?.assignTo ?? '').trim();
    if (!/^[a-z0-9_-]{1,80}$/i.test(id) || !category || category.length > 80 || !assignTo || assignTo.length > 120 || typeof rule?.enabled !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'Each routing rule must contain a valid id, category, assignment, and enabled state' });
    }
    safeRules.push({ id, category, assignTo, enabled: rule.enabled });
  }

  const config: RoutingConfig = { rules: safeRules, updatedAt: new Date().toISOString() };
  await writeRoutingConfig(config, session.adminId);

  appendAudit({
    event:   'admin_support_routing_updated',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    meta:    { ruleCount: safeRules.length },
  });

  return res.json({ ok: true, config });
}
