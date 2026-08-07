import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendRejectionEmail } from '../../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;

  const { userId, reason } = req.body as { userId?: string; reason?: string };
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const rejectionReason = reason ?? 'Your application did not meet our compliance requirements.';

  await updateUser(userId, {
    status: 'rejected',
    kycStatus: 'rejected',
    rejectedAt: new Date().toISOString(),
    rejectedBy: session.adminId,
    rejectionReason,
  });

  appendAudit({ event: 'admin_user_reject', adminId: session.adminId, userId, email: user.email, reason: rejectionReason });

  await sendRejectionEmail(user.email, user.name, rejectionReason);

  return res.json({ ok: true, message: `${user.name} has been rejected and notified.` });
}
