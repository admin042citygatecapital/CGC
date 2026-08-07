/**
 * POST /api/admin/support/routing
 * Save auto-assignment routing rules.
 * Body: { rules: RoutingRule[] }
 */
import type { Request, Response } from 'express';
import { writeRoutingConfig } from '../../../../lib/supportStore.js';
import type { RoutingConfig } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { rules } = req.body ?? {};
  if (!Array.isArray(rules)) return res.status(400).json({ ok: false, error: 'rules array required' });

  const config: RoutingConfig = { rules, updatedAt: new Date().toISOString() };
  writeRoutingConfig(config);

  appendAudit({
    event:   'admin_support_routing_updated',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    meta:    { ruleCount: rules.length },
  });

  return res.json({ ok: true, config });
}
