/**
 * POST /api/admin/kyc/flag
 * Body: { userId, reason, severity? }
 * Raises a security flag (securityStore.ts — the same store
 * admin/security/alerts and admin/security/threats already draw from) and
 * logs a KYC audit entry, without changing kycStatus.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { createFlag, type FlagSeverity } from '../../../../lib/securityStore.js';
import { appendKYCAudit } from '../../../../lib/kycAuditStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const satisfies readonly FlagSeverity[];

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId } = req.body as { userId?: string };
  const reason = sanitizeString((req.body as { reason?: unknown }).reason, 1000);
  const severity = isOneOf((req.body as { severity?: unknown }).severity, SEVERITIES) ?? 'medium';
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  if (!reason) return res.status(400).json({ ok: false, error: 'reason is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const flag = createFlag({
    userId, userName: user.name, userEmail: user.email,
    type: 'kyc_mismatch', severity, status: 'active',
    title: 'KYC flagged by admin', detail: reason,
  });

  appendKYCAudit({
    kycSubmissionId: userId, userId, reviewerEmail: session.email, reviewerId: session.adminId,
    action: 'flagged_manual', previousStatus: user.kycStatus, newStatus: user.kycStatus, notes: reason, reviewerIp: req.ip ?? 'unknown',
  });
  appendAudit({ event: 'admin_kyc_flag', adminId: session.adminId, userId, email: user.email, ip: req.ip ?? 'unknown', reason });

  return res.status(201).json({ ok: true, flag });
}
