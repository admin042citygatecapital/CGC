/**
 * POST /api/admin/kyc/request-info
 * Request additional information from a user.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { appendKycNote } from '../../../../lib/kycStore.js';
import { sendMail } from '../../../../lib/emailService.js';
import { escapeEmailHtml } from '../../../../lib/emailLayout.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';
import { getLatestOnboardingCaseForUser, reviewOnboardingCase } from '../../../../lib/onboardingStore.js';
import { createNotification } from '../../../../lib/notificationStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId } = req.body as { userId?: string };
  const message = sanitizeNote(req.body?.message ?? '');
  if (!userId)  return res.status(400).json({ error: 'userId required' });
  if (message.length < 10) return res.status(400).json({ error: 'An information request of at least 10 characters is required.' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const onboardingCase = await getLatestOnboardingCaseForUser(userId);
  if (!onboardingCase) return res.status(409).json({ error: 'A submitted onboarding case is required.', code: 'ONBOARDING_CASE_REQUIRED' });
  await appendCriticalAudit({ event: 'admin_kyc_request_info_intent', adminId: session.adminId, userId, email: user.email, reason: message, ip: req.ip ?? 'unknown' });
  try {
    await reviewOnboardingCase({ caseId: onboardingCase.id, reviewerId: session.adminId, decision: 'needs_info', reason: message });
  } catch (error) {
    const typed = error as Error & { code?: string };
    return res.status(409).json({ error: typed.message, code: typed.code });
  }

  await updateUser(userId, { status: 'pending_kyc', kycStatus: 'submitted' });

  appendKycNote({ userId, adminId: session.adminId, note: `[INFO REQUEST] ${message}`, createdAt: new Date().toISOString() });

  appendAudit({
    event:   'admin_kyc_request_info',
    adminId: session.adminId,
    userId,
    email:   user.email,
    reason:  message,
    ip:      req.ip ?? 'unknown',
  });

  await sendMail({
    to:      user.email,
    subject: 'Additional Information Required — City Gate Capital KYC',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#C9A84C">Additional Information Required</h2>
        <p>Dear ${escapeEmailHtml(user.name)},</p>
        <p>Our compliance team has reviewed your KYC submission and requires additional information before we can proceed:</p>
        <blockquote style="border-left:3px solid #C9A84C;padding:12px 16px;background:#fafafa;margin:16px 0">
          ${escapeEmailHtml(message)}
        </blockquote>
        <p>Please log in to your account and resubmit your KYC with the requested information.</p>
        <p style="margin-top:24px">City Gate Capital Compliance Team</p>
      </div>
    `,
  });

  await createNotification(userId, 'Additional identity information required', message, '/kyc');

  return res.json({ ok: true, message: 'Information request sent.' });
}
