import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAuditEntry } from '../../../../lib/auditLog.js';
import { createNotification } from '../../../../lib/notificationStore.js';
import { sanitizeNote, safeParseId } from '../../../../lib/inputValidator.js';

type Action = 'suspend' | 'freeze' | 'reactivate';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;

  const userId = safeParseId(req.body?.userId);
  const action = String(req.body?.action ?? '') as Action | 'approve_kyc' | 'reject_kyc';
  const reason = sanitizeNote(req.body?.reason ?? '').slice(0, 1000);
  if (!userId || !action) return res.status(400).json({ error: 'userId and action required' });
  if (reason.length < 10) return res.status(400).json({ error: 'A rationale of at least 10 characters is required.' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (action === 'approve_kyc' || action === 'reject_kyc') {
    return res.status(409).json({ error: 'KYC decisions must be completed in the KYC case-review screen.', code: 'KYC_CASE_REVIEW_REQUIRED' });
  }

  const patches: Record<Action, object> = {
    suspend:     { status: 'suspended' },
    freeze:      { status: 'frozen' },
    reactivate:  { status: 'active' },
  };

  if (!patches[action]) return res.status(400).json({ error: 'Unknown action' });

  if (action === 'reactivate' && (!user.emailVerified || user.kycStatus !== 'approved' || user.amlStatus !== 'cleared')) {
    return res.status(409).json({ error: 'Reactivation requires verified email, approved KYC, and cleared AML.', code: 'COMPLIANCE_CLEARANCE_REQUIRED' });
  }

  await updateUser(userId, patches[action]);
  await appendAuditEntry({
    adminId: session.adminId, adminEmail: session.email, action: `admin_user_${action}`,
    target: 'user', targetId: userId, ip: req.ip, details: { userId, reason, previousStatus: user.status, nextStatus: action === 'reactivate' ? 'active' : action === 'freeze' ? 'frozen' : 'suspended' },
  });
  await createNotification(userId, `Platform profile ${action === 'reactivate' ? 'reactivated' : action + 'ed'}`, reason, '/dashboard/profile');

  return res.json({ ok: true });
}
