import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

type Action = 'suspend' | 'freeze' | 'reactivate';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;

  const { userId, action, reason } = req.body as { userId?: string; action?: Action | 'approve_kyc' | 'reject_kyc'; reason?: string };
  if (!userId || !action) return res.status(400).json({ error: 'userId and action required' });

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

  await updateUser(userId, patches[action]);
  appendAudit({ event: `admin_user_${action}`, adminId: session.adminId, userId, email: user.email, reason });

  return res.json({ ok: true });
}
