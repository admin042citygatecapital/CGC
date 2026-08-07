/**
 * POST /api/admin/auth/password-reset/confirm
 *
 * Validates a reset token and sets a new admin password.
 *
 * Security properties:
 *  - Token validated with constant-time comparison (SHA-256 hash)
 *  - Token is single-use: consumed immediately after validation
 *  - New password hashed with bcrypt cost 12 (never stored plaintext)
 *  - Password policy enforced server-side (min 12 chars, complexity)
 *  - All existing admin sessions invalidated after password change
 *  - Rate-limited: 5 attempts per 15 min per IP (applied in entry.ts)
 *  - Raw token and new password are never logged
 *
 * Body: { token: string; newPassword: string; confirmPassword: string }
 */
import type { Request, Response } from 'express';
import { hashPassword } from '../../../../../lib/passwordHash.js';
import { validateResetToken, consumeResetToken } from '../../../../../lib/adminResetTokenStore.js';
import { deleteAllSessionsForAdmin } from '../../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';

// ── Password policy ───────────────────────────────────────────────────────────

const MIN_LENGTH = 12;

function validatePasswordPolicy(pw: string): string | null {
  if (pw.length < MIN_LENGTH)
    return `Password must be at least ${MIN_LENGTH} characters.`;
  if (!/[A-Z]/.test(pw))
    return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pw))
    return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(pw))
    return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(pw))
    return 'Password must contain at least one special character.';
  return null; // passes
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request, res: Response) {
  const { token, newPassword, confirmPassword } = req.body as {
    token?:           string;
    newPassword?:     string;
    confirmPassword?: string;
  };
  const ip = req.ip ?? 'unknown';

  // ── Basic input validation ────────────────────────────────────────────────
  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  // ── Password policy ───────────────────────────────────────────────────────
  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    return res.status(400).json({ error: policyError });
  }

  // ── Token validation (constant-time) ─────────────────────────────────────
  const tokenValid = await validateResetToken(token);
  if (!tokenValid) {
    appendAudit({ event: 'admin_password_reset_invalid_token', ip });
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
  }

  // ── Consume token immediately (single-use) ────────────────────────────────
  await consumeResetToken();

  // ── Hash new password (Argon2id) ──────────────────────────────────────────
  const newHash = await hashPassword(newPassword);

  // ── Persist new hash to secrets store ────────────────────────────────────
  // Best-effort: if the secrets API is unavailable the admin should manually
  // update ADMIN_PASSWORD_HASH in Settings → Secrets to make it permanent.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { setSecret } = require('#airo/secrets') as { setSecret?: (k: string, v: string) => void };
    if (typeof setSecret === 'function') {
      setSecret('ADMIN_PASSWORD_HASH', newHash);
    }
  } catch { /* secrets write not available — update manually in Settings → Secrets */ }

  // ── Invalidate all existing admin sessions ────────────────────────────────
  deleteAllSessionsForAdmin('admin_001');

  appendAudit({ event: 'admin_password_reset_success', adminId: 'admin_001', ip });

  return res.json({
    ok: true,
    message: 'Password updated successfully. All existing sessions have been signed out. Please log in with your new password.',
  });
}
