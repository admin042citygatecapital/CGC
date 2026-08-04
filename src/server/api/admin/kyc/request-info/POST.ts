/**
 * POST /api/admin/kyc/request-info
 * Body: { userId, message }
 * UserRecord's KYCStatus is 'not_submitted'|'submitted'|'approved'|'rejected'
 * — there's no "needs more info" status in the data model, so this leaves
 * kycStatus as 'submitted' (the customer still has an open, actionable
 * application) and communicates the request via email + an audit trail
 * entry, rather than inventing a status this schema doesn't have.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { appendKYCAudit } from '../../../../lib/kycAuditStore.js';
import { appendKycNote } from '../../../../lib/kycStore.js';
import { sendMail } from '../../../../lib/emailService.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId } = req.body as { userId?: string };
  const message = sanitizeString((req.body as { message?: unknown }).message, 2000);
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  if (!message) return res.status(400).json({ ok: false, error: 'message is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  appendKYCAudit({
    kycSubmissionId: userId, userId, reviewerEmail: session.email, reviewerId: session.adminId,
    action: 'requested_info', previousStatus: user.kycStatus, newStatus: user.kycStatus, notes: message, reviewerIp: req.ip ?? 'unknown',
  });
  await appendKycNote({ userId, adminId: session.adminId, adminName: session.email, note: `[Info requested] ${message}`, createdAt: new Date().toISOString() });
  appendAudit({ event: 'admin_kyc_request_info', adminId: session.adminId, userId, email: user.email, ip: req.ip ?? 'unknown' });

  await sendMail({
    to: user.email,
    subject: 'Additional information needed for your KYC verification — City Gate Capital',
    html: `<p>Hello ${user.name},</p><p>Our compliance team needs a bit more information to complete your verification:</p><p>${message}</p><p>Please log in to your account and update your KYC submission.</p>`,
  });

  return res.json({ ok: true, message: `Information request sent to ${user.email}.` });
}
