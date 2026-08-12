/**
 * POST /api/admin/users/delete
 * Hard deletion is intentionally disabled. Regulated customer and financial
 * records must be suspended, retained, or processed through the controlled
 * quarantine/retention workflow.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { appendCriticalAudit } from '../../../../lib/auditLog.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, reason } = req.body as { userId?: string; reason?: string };

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const rationale = sanitizeNote(reason ?? '').slice(0, 1000);
  if (rationale.length < 10) return res.status(400).json({ error: 'A rationale of at least 10 characters is required.' });

  await appendCriticalAudit({
    event: 'admin_user_hard_delete_blocked',
    adminId: session.adminId,
    userId: user.id,
    email: session.email,
    ip: req.ip,
    reason: rationale,
    meta: { targetEmail: user.email, name: user.name, status: user.status, kycStatus: user.kycStatus },
  });

  return res.status(409).json({
    error: 'Permanent customer deletion is disabled. Suspend the profile or use the controlled retention/quarantine workflow.',
    code: 'HARD_DELETE_DISABLED',
  });
}
