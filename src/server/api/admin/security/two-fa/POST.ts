/** POST /api/admin/security/two-fa — update the durable 2FA policy. */
import type { Request, Response } from 'express';
import { appendCriticalAudit } from '../../../../lib/auditLog.js';
import {
  readTwoFactorPolicy,
  writeTwoFactorPolicy,
  type TwoFAPolicy,
} from '../../../../lib/securityConfigStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  try {
    const body = req.body as Record<string, unknown>;
    const current = await readTwoFactorPolicy();
    const withdrawalThreshold = Number(body.withdrawalThreshold ?? current.withdrawalThreshold);
    if (!Number.isFinite(withdrawalThreshold) || withdrawalThreshold < 0 || withdrawalThreshold > 10_000_000) {
      return res.status(400).json({ error: 'Withdrawal threshold must be between 0 and 10,000,000' });
    }
    const booleanField = (key: keyof Pick<TwoFAPolicy, 'mandatoryForAll' | 'mandatoryForWithdrawals' | 'mandatoryForWires'>) =>
      typeof body[key] === 'boolean' ? body[key] as boolean : current[key];
    const proposed: TwoFAPolicy = {
      mandatoryForAll: booleanField('mandatoryForAll'),
      mandatoryForWithdrawals: booleanField('mandatoryForWithdrawals'),
      withdrawalThreshold,
      mandatoryForWires: booleanField('mandatoryForWires'),
      updatedAt: new Date().toISOString(),
      updatedBy: session.email,
    };

    await appendCriticalAudit({
      event: 'admin_security_two_factor_policy_change_authorized',
      adminId: session.adminId,
      email: session.email,
      ip: req.ip ?? 'unknown',
      reason: 'Administrator updated the two-factor authentication policy',
      meta: { previous: current, resulting: proposed },
    });
    const policy = await writeTwoFactorPolicy(proposed, session.adminId);
    return res.json({ ok: true, policy });
  } catch {
    return res.status(503).json({ error: 'Two-factor authentication policy could not be updated' });
  }
}
