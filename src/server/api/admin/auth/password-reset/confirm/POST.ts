/**
 * POST /api/admin/auth/password-reset/confirm
 *
 * The previous AIRO implementation attempted to mutate a deployment secret at
 * runtime and then reported success even when no durable update occurred.
 * Environment variables are immutable on standard hosts. Until managed auth
 * owns administrator credentials, this endpoint validates input and tokens but
 * fails closed without consuming the reset token.
 */
import type { Request, Response } from 'express';
import { validateResetToken } from '../../../../../lib/adminResetTokenStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';

const MIN_LENGTH = 12;

function validatePasswordPolicy(password: string): string | null {
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
  return null;
}

export default async function handler(req: Request, res: Response) {
  const { token, newPassword, confirmPassword } = req.body as {
    token?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  const ip = req.ip ?? 'unknown';

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }
  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) return res.status(400).json({ error: policyError });

  const tokenValid = await validateResetToken(token);
  if (!tokenValid) {
    appendAudit({ event: 'admin_password_reset_invalid_token', ip });
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
  }

  appendAudit({ event: 'admin_password_reset_unavailable', adminId: 'admin_001', ip });
  return res.status(503).json({
    error: 'Administrator password changes are temporarily unavailable while managed authentication is being migrated.',
  });
}
