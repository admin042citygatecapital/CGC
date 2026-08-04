/**
 * POST /api/admin/auth/password-reset
 * Body: { email }
 * Issues a reset token for the single admin account (see
 * adminResetTokenStore.ts / adminCredentials.ts — this app has exactly one
 * admin identity, provisioned via ADMIN_EMAIL/ADMIN_PASSWORD_HASH) and
 * emails it. Always returns ok:true regardless of whether the email
 * matches, to avoid account enumeration.
 */
import type { Request, Response } from 'express';
import { findAdminByEmail } from '../../../../lib/adminCredentials.js';
import { issueResetToken, EXPIRY_MINUTES } from '../../../../lib/adminResetTokenStore.js';
import { sendAdminPasswordResetEmail } from '../../../../lib/emailService.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isValidEmail } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const email = sanitizeString(req.body?.email).toLowerCase();
  const ip = req.ip ?? 'unknown';

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'A valid email address is required' });
  }

  const admin = await findAdminByEmail(email);
  if (admin) {
    const token = await issueResetToken();
    appendAudit({ event: 'admin_password_reset_requested', adminId: admin.id, email: admin.email, ip });
    await sendAdminPasswordResetEmail(admin.email, admin.name, token, ip, EXPIRY_MINUTES);
  }

  return res.json({
    ok: true,
    message: 'If that email matches an admin account, a reset link has been sent.',
  });
}
