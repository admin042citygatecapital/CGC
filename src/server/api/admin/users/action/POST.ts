import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

type Action = 'suspend' | 'freeze' | 'reactivate' | 'approve_kyc' | 'reject_kyc';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;

  const { userId, action, reason } = req.body as { userId?: string; action?: Action; reason?: string };
  if (!userId || !action) return res.status(400).json({ ok: false, error: 'userId and action required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const patches: Record<Action, object> = {
    suspend:     { status: 'suspended' },
    freeze:      { status: 'frozen' },
    reactivate:  { status: 'active' },
    approve_kyc: { kycStatus: 'approved', status: 'pending_approval' },
    reject_kyc:  { kycStatus: 'rejected', rejectionReason: reason },
  };

  if (!patches[action]) return res.status(400).json({ ok: false, error: 'Unknown action' });

  await updateUser(userId, patches[action]);
  appendAudit({ event: `admin_user_${action}`, adminId: session.adminId, userId, email: user.email, reason });

  return res.json({ ok: true });
}
