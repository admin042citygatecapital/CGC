/**
 * POST /api/admin/kyc/approve
 * Body: { userId, validityMonths?, note? }
 *
 * Not a copy of admin/kyc/:userId/approve/POST.ts — that route (and its
 * approve/reject/flag/request-info siblings) calls
 * createSubmission/getAllSubmissions/updateSubmission from kycStore.ts,
 * none of which that file actually exports (a pre-existing gap flagged
 * separately). This route only touches functions that genuinely exist:
 * userStore.updateUser (kycStatus), kycExpiryStore.upsertKYCExpiry, and
 * kycAuditStore.appendKYCAudit — the same primitives
 * admin/users/approve/POST.ts already uses successfully.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { readKycSettings } from '../../../../lib/kycStore.js';
import { upsertKYCExpiry } from '../../../../lib/kycExpiryStore.js';
import { appendKYCAudit } from '../../../../lib/kycAuditStore.js';
import { sendApprovalEmail } from '../../../../lib/emailService.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, validityMonths: rawValidity, note } = req.body as { userId?: string; validityMonths?: number; note?: string };
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const settings = await readKycSettings();
  const validityMonths = typeof rawValidity === 'number' && rawValidity > 0 ? rawValidity : settings.expiryMonths;

  const now = new Date();
  const expiryDate = new Date(now.getTime() + validityMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
  const renewalDueDate = new Date(new Date(expiryDate).getTime() - settings.renewalReminderDays * 24 * 60 * 60 * 1000).toISOString();

  await updateUser(userId, { kycStatus: 'approved', kycApprovedAt: now.toISOString() } as never);

  upsertKYCExpiry({
    userId, kycSubmissionId: userId, approvedAt: now.toISOString(), expiryDate, renewalDueDate,
    validityMonths, status: 'active', reminders: { sent30: false, sent14: false, sent7: false, sent1: false },
  });

  appendKYCAudit({
    kycSubmissionId: userId, userId, reviewerEmail: session.email, reviewerId: session.adminId,
    action: 'approved', previousStatus: user.kycStatus, newStatus: 'approved', notes: note, reviewerIp: req.ip ?? 'unknown',
  });
  appendAudit({ event: 'admin_kyc_approve', adminId: session.adminId, userId, email: user.email, ip: req.ip ?? 'unknown' });

  sendApprovalEmail(user.email, user.name).catch(() => {});

  return res.json({ ok: true, message: `${user.name}'s KYC has been approved.`, expiryDate, validityMonths });
}
