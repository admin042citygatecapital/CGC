/**
 * POST /api/users/password-reset
 * Initiates a password reset — sends a reset link to the user's email.
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { findUserByEmail, updateUser } from '../../../lib/userStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sendPasswordResetEmail } from '../../../lib/emailService.js';
import { sanitizeString, isValidEmail } from '../../../lib/inputValidator.js';

function baseUrl(req: Request) {
  const env = process.env.PUBLIC_URL || process.env.SITE_URL;
  if (env) return env.replace(/\/+$/, '');
  return `${req.protocol}://${req.hostname}`;
}

export default async function handler(req: Request, res: Response) {
  const email = sanitizeString(req.body?.email).toLowerCase();
  const ip    = req.ip ?? 'unknown';

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  // Always return success to prevent email enumeration
  const user = await findUserByEmail(email);
  if (user && user.status !== 'rejected') {
    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    await updateUser(user.id, { passwordResetToken: token, passwordResetExpiry: expiry } as never);
    appendAudit({ event: 'password_reset_requested', userId: user.id, email, ip });
    const base = baseUrl(req);
    await sendPasswordResetEmail(email, user.name, token, base);
  }

  return res.json({
    ok: true,
    message: 'If an account with that email exists, a reset link has been sent.',
  });
}
