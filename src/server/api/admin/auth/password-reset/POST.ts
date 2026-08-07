/**
 * POST /api/admin/auth/password-reset
 *
 * Initiates an admin password reset.
 *
 * Security properties:
 *  - Rate-limited: 3 requests per 15 min per IP (applied in entry.ts)
 *  - Always returns the same generic success message regardless of whether
 *    the email matches a registered admin (no account enumeration)
 *  - Raw token is never logged — only the SHA-256 hash is stored
 *  - Sends reset email only when the email matches the registered admin
 *
 * Body: { email: string }
 */
import type { Request, Response } from 'express';
import { findAdminByEmail } from '../../../../lib/adminCredentials.js';
import { issueResetToken, EXPIRY_MINUTES } from '../../../../lib/adminResetTokenStore.js';
import { sendAdminPasswordResetEmail } from '../../../../lib/emailService.js';
import { appendAudit } from '../../../../lib/auditLog.js';

// Generic message — identical for found and not-found to prevent enumeration
const GENERIC_MSG = 'If that email is registered, a reset link has been sent. Check your inbox.';

export default async function handler(req: Request, res: Response) {
  const { email } = req.body as { email?: string };
  const ip = req.ip ?? 'unknown';

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const normalised = email.trim().toLowerCase();
  const admin = findAdminByEmail(normalised);

  if (admin) {
    // Issue token and send email — fire-and-forget so timing is not leaked
    const rawToken = await issueResetToken();
    appendAudit({ event: 'admin_password_reset_requested', email: normalised, ip });

    // Do NOT await — return generic response immediately to prevent timing oracle
    sendAdminPasswordResetEmail(admin.email, admin.name, rawToken, ip, EXPIRY_MINUTES)
      .catch(() => {
        // Swallow silently — never expose email delivery errors to the caller
      });
  } else {
    // Simulate a small async delay so timing is indistinguishable from the
    // real path (which fires off an async email send)
    await new Promise(r => setTimeout(r, 80 + Math.random() * 40));
  }

  // Always return the same response
  return res.json({ ok: true, message: GENERIC_MSG });
}
