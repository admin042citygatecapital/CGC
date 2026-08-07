import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendApprovalEmail } from '../../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;

  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.status === 'active') {
    return res.status(409).json({ error: 'User is already active' });
  }

  await updateUser(userId, {
    status: 'active',
    kycStatus: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: session.adminId,
  });

  appendAudit({ event: 'admin_user_approve', adminId: session.adminId, userId, email: user.email });

  await sendApprovalEmail(user.email, user.name);

  return res.json({ ok: true, message: `${user.name} has been approved and notified.` });
}
