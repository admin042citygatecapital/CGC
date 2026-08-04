/**
 * POST /api/admin/security/two-fa
 * Body: Partial<TwoFAPolicy> — mandatoryForAll?, mandatoryForWithdrawals?,
 *       withdrawalThreshold?, mandatoryForWires?
 */
import type { Request, Response } from 'express';
import { read2FAPolicy, write2FAPolicy } from '../../../../lib/securityStore.js';
import { appendAlert } from '../../../../lib/securityCenterStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const current = read2FAPolicy();
  const adminId = req.adminSession?.adminId;
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';

  const next = {
    ...current,
    mandatoryForAll: typeof raw.mandatoryForAll === 'boolean' ? raw.mandatoryForAll : current.mandatoryForAll,
    mandatoryForWithdrawals: typeof raw.mandatoryForWithdrawals === 'boolean' ? raw.mandatoryForWithdrawals : current.mandatoryForWithdrawals,
    withdrawalThreshold: typeof raw.withdrawalThreshold === 'number' && raw.withdrawalThreshold >= 0 ? raw.withdrawalThreshold : current.withdrawalThreshold,
    mandatoryForWires: typeof raw.mandatoryForWires === 'boolean' ? raw.mandatoryForWires : current.mandatoryForWires,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };
  write2FAPolicy(next);

  appendAudit({ event: 'security_2fa_policy_updated', adminId, email: adminEmail, ip });
  appendAlert({
    type: 'config_change', severity: 'medium',
    title: '2FA policy updated',
    detail: `${adminEmail} updated the platform 2FA policy.`,
    adminId, resolved: false,
  });

  return res.json({ ok: true, policy: next });
}
