import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendRejectionEmail } from '../../../../lib/emailService.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;

  if (session.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only a super-administrator may deny a customer application.', code: 'SUPER_ADMIN_REQUIRED' });
  }

  const { userId, reason } = req.body as { userId?: string; reason?: string };
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const rejectionReason = sanitizeNote(reason ?? '').slice(0, 1000);
  if (rejectionReason.length < 10) return res.status(400).json({ error: 'A denial rationale of at least 10 characters is required.' });

  await updateUser(userId, {
    status: 'rejected',
    kycStatus: 'rejected',
    rejectedAt: new Date().toISOString(),
    rejectedBy: session.adminId,
    rejectionReason,
  });

  appendAudit({ event: 'admin_user_reject', adminId: session.adminId, userId, email: user.email, reason: rejectionReason,
    meta: { previousStatus: user.status, finalApplicationDenial: true } });

  await sendRejectionEmail(user.email, user.name, rejectionReason);

  return res.json({ ok: true, message: `${user.name} has been rejected and notified.` });
}
