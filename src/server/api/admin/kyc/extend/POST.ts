/**
 * POST /api/admin/kyc/extend
 * Body: { userId, months, note? }
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { extendKyc } from '../../../../lib/kycStore.js';
import { appendKYCAudit } from '../../../../lib/kycAuditStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, months: rawMonths, note } = req.body as { userId?: string; months?: number; note?: string };
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  const months = typeof rawMonths === 'number' && rawMonths > 0 ? rawMonths : 12;

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  await extendKyc(userId, months, session.adminId);

  appendKYCAudit({
    kycSubmissionId: userId, userId, reviewerEmail: session.email, reviewerId: session.adminId,
    action: 'extended', previousStatus: user.kycStatus, newStatus: 'approved', notes: note, reviewerIp: req.ip ?? 'unknown',
  });
  appendAudit({ event: 'admin_kyc_extend', adminId: session.adminId, userId, email: user.email, ip: req.ip ?? 'unknown', meta: { months } });

  return res.json({ ok: true, message: `${user.name}'s KYC extended by ${months} month(s).` });
}
