/**
 * POST /api/admin/kyc/extend
 * Extend or revoke a user's KYC approval.
 * Body: { userId, action: 'extend' | 'revoke', months?: number, reason?: string }
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { extendKyc, revokeKyc } from '../../../../lib/kycStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, action, months, reason } = req.body as {
    userId?: string; action?: string; months?: number; reason?: string;
  };
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (!action) return res.status(400).json({ error: 'action required (extend | revoke)' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (action === 'extend') {
    const m = Number(months ?? 12);
    await extendKyc(userId, m, session.adminId);
    appendAudit({ event: 'admin_kyc_extend', adminId: session.adminId, userId, email: user.email, meta: { months: m }, ip: req.ip ?? 'unknown' });
    return res.json({ ok: true, message: `KYC extended by ${m} months.` });
  }

  if (action === 'revoke') {
    const r = reason ?? 'KYC revoked by administrator.';
    await revokeKyc(userId, r, session.adminId);
    appendAudit({ event: 'admin_kyc_revoke', adminId: session.adminId, userId, email: user.email, reason: r, ip: req.ip ?? 'unknown' });
    return res.json({ ok: true, message: `KYC revoked for ${user.name}.` });
  }

  return res.status(400).json({ error: 'action must be extend or revoke' });
}
