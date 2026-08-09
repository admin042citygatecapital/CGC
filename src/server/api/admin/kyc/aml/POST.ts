import type { Request, Response } from 'express';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeNote, safeParseId, isOneOf } from '../../../../lib/inputValidator.js';
import {
  findUserById,
  updateUser,
  type AMLRiskLevel,
  type AMLStatus,
} from '../../../../lib/userStore.js';

const AML_STATUSES = ['not_screened', 'pending', 'cleared', 'review', 'blocked'] as const;
const RISK_LEVELS = ['unrated', 'low', 'medium', 'high'] as const;

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const userId = safeParseId(req.body?.userId);
  const amlStatus = isOneOf(req.body?.amlStatus, AML_STATUSES) as AMLStatus | null;
  const amlRiskLevel = isOneOf(req.body?.amlRiskLevel ?? 'unrated', RISK_LEVELS) as AMLRiskLevel | null;
  const reason = sanitizeNote(req.body?.reason ?? '').slice(0, 1000);

  if (!userId) return res.status(400).json({ error: 'A valid userId is required.' });
  if (!amlStatus) return res.status(400).json({ error: 'A valid AML status is required.' });
  if (!amlRiskLevel) return res.status(400).json({ error: 'A valid AML risk level is required.' });
  if (['cleared', 'review', 'blocked'].includes(amlStatus) && reason.length < 10) {
    return res.status(400).json({ error: 'A review rationale of at least 10 characters is required for this decision.' });
  }

  let amlNextReviewAt: string | undefined;
  if (req.body?.nextReviewAt) {
    const parsed = new Date(String(req.body.nextReviewAt));
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'nextReviewAt must be a valid future date.' });
    }
    amlNextReviewAt = parsed.toISOString();
  }
  if (amlStatus === 'cleared' && !amlNextReviewAt) {
    return res.status(400).json({ error: 'A future review date is required when AML is cleared.' });
  }

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const now = new Date().toISOString();
  const nextAccountStatus = amlStatus === 'blocked' && ['active', 'pending_approval'].includes(user.status)
    ? 'frozen'
    : amlStatus === 'cleared' && user.status === 'pending_approval' && user.kycStatus === 'approved' && user.emailVerified
      ? 'active'
      : user.status;
  const updated = await updateUser(userId, {
    status: nextAccountStatus,
    amlStatus,
    amlRiskLevel,
    amlReviewedAt: now,
    amlReviewedBy: session.adminId,
    amlReviewReason: reason,
    amlNextReviewAt: amlStatus === 'cleared' ? amlNextReviewAt : '',
  });

  appendAudit({
    event: 'admin_aml_decision',
    adminId: session.adminId,
    userId,
    email: user.email,
    ip: req.ip ?? 'unknown',
    reason,
    meta: {
      previousStatus: user.amlStatus ?? 'not_screened',
      amlStatus,
      amlRiskLevel,
      nextReviewAt: amlNextReviewAt ?? null,
      accountStatus: nextAccountStatus,
    },
  });

  return res.json({ ok: true, user: updated });
}
