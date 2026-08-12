/**
 * POST /api/admin/users/override
 * Emergency super-admin controls. Verification links can be resent, but email
 * verification itself cannot be bypassed by an administrator.
 *
 * Body: { userId: string; action: 'resend_verification' | 'approve' | 'activate' | 'resend_welcome' }
 * Requires: superadmin role
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser, generateVerifyToken } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { evaluateFinancialAccess } from '../../../../lib/complianceGate.js';
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

const VALID_ACTIONS = ['resend_verification', 'approve', 'activate', 'resend_welcome'] as const;
type OverrideAction = typeof VALID_ACTIONS[number];

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, action } = req.body as { userId?: string; action?: OverrideAction };

  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  if (!action || !VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ ok: false, error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const adminId = session.adminId;

  try {
    switch (action) {
      case 'resend_verification': {
        const { token, expiry } = generateVerifyToken();
        await appendCriticalAudit({ event: 'admin_resend_verification_intent', userId, adminId, email: session.email,
          ip: req.ip, meta: { targetEmail: user.email } });
        await updateUser(userId, { emailVerifyToken: token, emailVerifyExpiry: expiry });
        await sendVerificationEmail(user.email, user.name, token, baseUrl(req));
        appendAudit({ event: 'admin_resend_verification', userId, email: user.email, adminId });
        return res.json({ ok: true, message: `Verification email resent to ${user.email}` });
      }

      case 'approve': {
        const compliance = await evaluateFinancialAccess({ ...user, status: 'active' });
        if (!compliance.allowed) {
          return res.status(409).json({ error: `Override cannot bypass compliance: ${compliance.message}`, code: compliance.code, compliance });
        }
        await appendCriticalAudit({ event: 'admin_override_approve_intent', userId, adminId, email: session.email,
          ip: req.ip, meta: { targetEmail: user.email, previousStatus: user.status } });
        await updateUser(userId, { status: 'active', approvedAt: new Date().toISOString(), approvedBy: adminId });
        await sendApprovalEmail(user.email, user.name);
        appendAudit({ event: 'admin_override_approve', userId, email: user.email, adminId });
        return res.json({ ok: true, message: `Account activated for ${user.email} after KYC and AML clearance.` });
      }

      case 'activate': {
        const compliance = await evaluateFinancialAccess({ ...user, status: 'active' });
        if (!compliance.allowed) {
          return res.status(409).json({ error: `Activation cannot bypass compliance: ${compliance.message}`, code: compliance.code, compliance });
        }
        await appendCriticalAudit({ event: 'admin_override_activate_intent', userId, adminId, email: session.email,
          ip: req.ip, meta: { targetEmail: user.email, previousStatus: user.status } });
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
