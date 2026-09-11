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
 *  - Sends reset email only when the email matches the registered admin, and
 *    only when the token hash could be persisted (a token that no validation
 *    path accepts must never reach the inbox)
 *  - Email delivery failures are logged and audited server-side, never
 *    exposed to the caller
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
  const admin = await findAdminByEmail(normalised);

  if (admin) {
    const rawToken = await issueResetToken();
    appendAudit({ event: 'admin_password_reset_requested', email: normalised, ip });

    if (rawToken) {
      // Do NOT await — return generic response immediately to prevent timing oracle
      sendAdminPasswordResetEmail(admin.email, admin.name, rawToken, ip, EXPIRY_MINUTES)
        .catch(() => {
          // Delivery failures never reach the caller, but they must be
          // observable server-side — a silently dropped email leaves the
          // admin locked out with no trace of why.
          console.error('admin_password_reset_email_failed', { ip });
          appendAudit({ event: 'admin_password_reset_email_failed', email: normalised, ip });
        });
    } else {
      // Token hash not persisted: skip the email — the link would be dead.
      console.error('admin_password_reset_issue_failed', { ip });
      appendAudit({ event: 'admin_password_reset_issue_failed', email: normalised, ip });
    }
  } else {
    // Simulate a small async delay so timing is indistinguishable from the
    // real path (which fires off an async email send)
    await new Promise(r => setTimeout(r, 80 + Math.random() * 40));
  }

  // Always return the same response
  return res.json({ ok: true, message: GENERIC_MSG });
}