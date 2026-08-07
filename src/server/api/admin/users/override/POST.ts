/**
 * POST /api/admin/users/override
 * Emergency admin override: resend verification, manually approve/activate,
 * trigger OTP, or manually verify email for a user.
 *
 * Body: { userId: string; action: 'resend_verification' | 'approve' | 'activate' | 'resend_otp' | 'manual_verify' }
 * Requires: superadmin role
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser, generateVerifyToken } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import {
  sendVerificationEmail,
  sendApprovalEmail,
  sendWelcomeEmail,
} from '../../../../lib/emailService.js';

function baseUrl(req: Request): string {
  const env = process.env.PUBLIC_URL || process.env.SITE_URL;
  if (env) return env.replace(/\/+$/, '');
  return `${req.protocol}://${req.hostname}`;
}

const VALID_ACTIONS = ['resend_verification', 'approve', 'activate', 'manual_verify', 'resend_welcome'] as const;
type OverrideAction = typeof VALID_ACTIONS[number];

export default async function handler(req: Request, res: Response) {
  const { userId, action } = req.body as { userId?: string; action?: OverrideAction };

  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  if (!action || !VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ ok: false, error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const adminId = (req as Request & { adminId?: string }).adminId ?? 'admin';

  try {
    switch (action) {
      case 'resend_verification': {
        const { token, expiry } = generateVerifyToken();
        await updateUser(userId, { emailVerifyToken: token, emailVerifyExpiry: expiry });
        await sendVerificationEmail(user.email, user.name, token, baseUrl(req));
        appendAudit({ event: 'admin_resend_verification', userId, email: user.email, adminId });
        return res.json({ ok: true, message: `Verification email resent to ${user.email}` });
      }

      case 'manual_verify': {
        await updateUser(userId, {
          emailVerified: true,
          emailVerifyToken: undefined,
          emailVerifyExpiry: undefined,
          status: user.status === 'pending_verification' ? 'pending_kyc' : user.status,
        });
        appendAudit({ event: 'admin_manual_verify', userId, email: user.email, adminId });
        return res.json({ ok: true, message: `Email manually verified for ${user.email}` });
      }

      case 'approve': {
        await updateUser(userId, {
          status: 'active',
          kycStatus: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: adminId,
        });
        await sendApprovalEmail(user.email, user.name);
        appendAudit({ event: 'admin_override_approve', userId, email: user.email, adminId });
        return res.json({ ok: true, message: `Account approved and activation email sent to ${user.email}` });
      }

      case 'activate': {
        await updateUser(userId, { status: 'active' });
        appendAudit({ event: 'admin_override_activate', userId, email: user.email, adminId });
        return res.json({ ok: true, message: `Account activated for ${user.email}` });
      }

      case 'resend_welcome': {
        await sendWelcomeEmail(user.email, user.name);
        appendAudit({ event: 'admin_resend_welcome', userId, email: user.email, adminId });
        return res.json({ ok: true, message: `Welcome email resent to ${user.email}` });
      }

      default:
        return res.status(400).json({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
