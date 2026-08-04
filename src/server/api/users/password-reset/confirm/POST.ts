/**
 * POST /api/users/password-reset/confirm
 * Validates the reset token and sets a new password.
 *
 * Reworked against the current backend: password hashing goes through
 * passwordHash.ts (Argon2id) instead of bcryptjs, and loadAllUsers/updateUser
 * (now async under the Drizzle-backed userStore.ts) are properly awaited.
 *
 * Note: `passwordResetToken`/`passwordResetExpiry` are not yet columns in
 * src/server/db/schema.ts (that file hasn't landed in this repo yet), so in
 * DB-backed mode (DATABASE_URL set) updateUser's field-mapping silently drops
 * them and this flow — together with the already-committed
 * users/password-reset/POST.ts, which sets the same two fields — only
 * persists the token end-to-end in flat-file mode today. Add
 * passwordResetToken/passwordResetExpiry to the users table (and to
 * userStore.ts's toRecord/updateUser mapping) to close that gap.
 */
import type { Request, Response } from 'express';
import { loadAllUsers, updateUser } from '../../../../lib/userStore.js';
import { hashPassword } from '../../../../lib/passwordHash.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, validatePassword } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const token    = sanitizeString(req.body?.token);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const ip       = req.ip ?? 'unknown';

  if (!token || !password) {
    return res.status(400).json({ ok: false, error: 'Token and new password are required' });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return res.status(400).json({ ok: false, error: pwCheck.reason });
  }

  const users = await loadAllUsers();
  const user  = users.find(u => (u as never as Record<string, string>).passwordResetToken === token);

  if (!user) {
    return res.status(400).json({ ok: false, error: 'Invalid or expired reset token' });
  }

  const expiry = (user as never as Record<string, string>).passwordResetExpiry;
  if (!expiry || new Date(expiry) < new Date()) {
    return res.status(400).json({ ok: false, error: 'Reset token has expired. Please request a new one.' });
  }

  const passwordHash = await hashPassword(password);
  await updateUser(user.id, {
    passwordHash,
    passwordResetToken: undefined,
    passwordResetExpiry: undefined,
  } as never);

  appendAudit({ event: 'password_reset_completed', userId: user.id, email: user.email, ip });

  return res.json({ ok: true, message: 'Password updated successfully. You can now log in.' });
}
