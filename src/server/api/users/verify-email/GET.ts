/**
 * GET /api/users/verify-email?token=...
 * Verifies a user's email address via the token sent during registration.
 * On success: redirects to /login?verified=success
 * On error:   redirects to /login?verified=error&reason=...
 *             (never returns bare JSON — prevents "Unexpected token <" on frontend)
 */
import type { Request, Response } from 'express';
import { findUserByVerifyToken, updateUser } from '../../../lib/userStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sendWelcomeEmail } from '../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const { token } = req.query as { token?: string };

  if (!token) {
    return res.redirect('/login?verified=error&reason=missing_token');
  }

  const user = await findUserByVerifyToken(token);
  if (!user) {
    return res.redirect('/login?verified=error&reason=invalid_token');
  }

  if (user.emailVerified) {
    return res.redirect('/login?verified=already');
  }

  // Check expiry
  if (user.emailVerifyExpiry && new Date(user.emailVerifyExpiry) < new Date()) {
    return res.redirect('/login?verified=error&reason=expired');
  }

  await updateUser(user.id, {
    emailVerified:     true,
    emailVerifyToken:  undefined,
    emailVerifyExpiry: undefined,
    status:            'pending_kyc',
  } as never);

  appendAudit({ event: 'email_verified', userId: user.id, email: user.email });

  // Fire welcome email — non-blocking, errors are queued for retry
  sendWelcomeEmail(user.email, user.name).catch(() => {});

  return res.redirect('/login?verified=success');
}
