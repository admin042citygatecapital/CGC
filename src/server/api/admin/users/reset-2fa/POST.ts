/**
 * POST /api/admin/users/reset-2fa
 * Clears any TOTP / 2FA secret for a customer and invalidates their session.
 * (Customer 2FA is stored in the user record as totpSecret / totpEnabled.)
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { authorizeAdminRole, authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, reason, confirmation } = req.body as { userId?: string; reason?: string; confirmation?: string };

  if (!authorizeAdminRole(req, res, 'SUPER_ADMIN')) return;
  if (!authorizeRecentAdminStepUp(req, res)) return;
  if (String(reason ?? '').trim().length < 8) return res.status(400).json({ error: 'A clear security reason is required.' });
  if (confirmation !== 'CONFIRM CUSTOMER 2FA RESET') return res.status(409).json({ error: 'Type CONFIRM CUSTOMER 2FA RESET to continue.' });

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await appendCriticalAudit({ event: 'admin_user_2fa_reset_intent', adminId: session.adminId, userId,
    email: session.email, ip: req.ip, reason, meta: { targetEmail: user.email, role: session.role } });
  // Clear 2FA fields and invalidate session
  await updateUser(userId, {
    totpSecret:  null,
    totpEnabled: false,
    // Invalidate session so user must re-login and re-enroll
    sessionToken:      undefined,
    sessionCreatedAt:  undefined,
    sessionLastSeenAt: undefined,
    sessionExpiresAt:  undefined,
  });

  appendAudit({
    event: 'admin_user_2fa_reset',
    adminId: session.adminId,
    userId,
    email: user.email,
    ip: req.ip,
    reason,
    meta: { role: session.role },
  });

  return res.json({ ok: true, message: `2FA cleared for ${user.name}. They must re-enroll on next login.` });
}
