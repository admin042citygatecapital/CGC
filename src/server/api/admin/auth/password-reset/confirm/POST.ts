/**
 * POST /api/admin/auth/password-reset/confirm
 * Body: { token, password }
 * Validates the reset token (adminResetTokenStore.ts) and persists a new
 * password hash via adminCredentials.ts's config-table override — see that
 * file's setAdminPasswordOverride for why this is necessary (the live
 * ADMIN_PASSWORD_HASH env var can't be rewritten by a running process).
 * Also terminates every existing admin session, forcing re-login.
 */
import type { Request, Response } from 'express';
import { validateResetToken, consumeResetToken } from '../../../../../lib/adminResetTokenStore.js';
import { setAdminPasswordOverride, hashPassword } from '../../../../../lib/adminCredentials.js';
import { purgeAllSessions } from '../../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';
import { sanitizeString, validatePassword } from '../../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const token = sanitizeString(req.body?.token);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const ip = req.ip ?? 'unknown';

  if (!token || !password) {
    return res.status(400).json({ ok: false, error: 'Token and new password are required' });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return res.status(400).json({ ok: false, error: pwCheck.reason });
  }

  const valid = await validateResetToken(token);
  if (!valid) {
    return res.status(400).json({ ok: false, error: 'Invalid or expired reset token' });
  }

  const newHash = await hashPassword(password);
  await setAdminPasswordOverride(newHash);
  await consumeResetToken();
  await purgeAllSessions();

  appendAudit({ event: 'admin_password_reset_completed', ip });

  return res.json({ ok: true, message: 'Password updated successfully. Please log in again.' });
}
