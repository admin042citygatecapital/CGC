/**
 * POST /api/admin/smartsupp/config
 * Body: Partial<SmartsuppConfig>
 */
import type { Request, Response } from 'express';
import { writeConfig, type SmartsuppConfig } from '../../../../lib/smartsuppStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const written = writeConfig(req.body as Partial<SmartsuppConfig>);
  appendAudit({ event: 'admin_smartsupp_config_updated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown' });
  const { apiKey, ...rest } = written;
  return res.json({ ok: true, config: { ...rest, apiKeySet: Boolean(apiKey) } });
}
