/**
 * POST /api/admin/auth/otp/resend
 *
 * Body: { challengeId }
 *
 * Replaces a device-bound verification challenge with a newly generated code.
 * The previous challenge is invalidated by issueOtp before the new code is sent.
 */
import type { Request, Response } from 'express';
import { findAdminByEmail } from '../../../../../lib/adminCredentials.js';
import { appendAudit } from '../../../../../lib/auditLog.js';
import { sendAdminOtpEmail } from '../../../../../lib/emailService.js';
import {
  discardOtpChallenge,
  getOtpTtlRemaining,
  issueOtp,
  validateOtpChallenge,
} from '../../../../../lib/otpStore.js';

export default async function handler(req: Request, res: Response) {
  const { challengeId } = req.body as { challengeId?: string };
  const ip = req.ip ?? 'unknown';
  const ua = req.headers['user-agent'] ?? 'unknown';

  if (!challengeId) {
    return res.status(400).json({ error: 'challengeId is required' });
  }

  const current = await validateOtpChallenge(challengeId, { ip, ua }, { allowExpired: true });
  if (!current.ok || !current.email || !current.adminId || current.credentialVersion === undefined) {
    appendAudit({
      event: 'otp_resend_rejected',
      ip,
      reason: current.locked ? 'device_mismatch' : current.expired ? 'challenge_expired' : 'invalid_challenge',
    });
    return res.status(current.locked ? 401 : 400).json({
      error: current.error ?? 'Invalid or expired verification session. Please log in again.',
      locked: current.locked ?? false,
      expired: current.expired ?? false,
    });
  }

  const admin = await findAdminByEmail(current.email);
  if (!admin || admin.id !== current.adminId || admin.credentialVersion !== current.credentialVersion) {
    appendAudit({ event: 'otp_resend_rejected', email: current.email, ip, reason: 'admin_not_found' });
    return res.status(400).json({ error: 'Invalid or expired verification session. Please log in again.' });
  }

  const replacement = await issueOtp({
    adminId: admin.id,
    email: admin.email,
    credentialVersion: admin.credentialVersion,
  }, ip, ua);
  if (!replacement.ok || !replacement.challengeId || !replacement.otp) {
    appendAudit({
      event: 'otp_resend_failed',
      adminId: admin.id,
      email: admin.email,
      ip,
      reason: replacement.rateLimited ? 'rate_limited' : 'issue_failed',
    });
    return res.status(replacement.rateLimited ? 429 : 503).json({
      error: replacement.error ?? 'Unable to create a new verification challenge.',
    });
  }

  let deliveryMode: 'email' | 'local';
  try {
    deliveryMode = await sendAdminOtpEmail(admin.email, admin.name, replacement.otp, ip, ua);
  } catch {
    await discardOtpChallenge(replacement.challengeId);
    appendAudit({ event: 'otp_delivery_failed', adminId: admin.id, email: admin.email, ip, reason: 'resend' });
    return res.status(503).json({ error: 'Unable to deliver the verification code. Please try again.' });
  }

  appendAudit({
    event: 'otp_resent',
    adminId: admin.id,
    email: admin.email,
    ip,
    meta: { deliveryMode },
  });
  return res.status(202).json({
    ok: true,
    otpRequired: true,
    challengeId: replacement.challengeId,
    expiresInSeconds: await getOtpTtlRemaining(replacement.challengeId),
    deliveryMode,
  });
}
