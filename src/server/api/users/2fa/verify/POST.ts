/**
 * POST /api/users/2fa/verify
 * Body: { challengeId: string, otp: string }
 * Completes 2FA enrollment (started by POST /api/users/2fa/setup with
 * action: 'enable') by confirming the emailed code, then sets
 * UserRecord.totpEnabled = true.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import { verifyOtp, getChallengeEmail } from '../../../../lib/otpStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { challengeId, otp } = req.body as { challengeId?: string; otp?: string };
  if (!challengeId || !otp) {
    return res.status(400).json({ ok: false, error: 'challengeId and otp are required' });
  }

  // The challenge must belong to the authenticated user's own email —
  // otherwise a stolen challengeId for someone else's setup flow could be
  // used to flip this account's totpEnabled flag.
  const challengeEmail = getChallengeEmail(challengeId);
  if (!challengeEmail || challengeEmail.toLowerCase() !== user.email.toLowerCase()) {
    return res.status(400).json({ ok: false, error: 'Invalid or expired verification session' });
  }

  const result = verifyOtp(challengeId, otp);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error ?? 'Verification failed' });
  }

  await updateUser(user.id, { totpEnabled: true } as never);
  appendAudit({ event: 'user_2fa_enabled', userId: user.id, email: user.email, ip: req.ip ?? 'unknown' });

  return res.json({ ok: true, totpEnabled: true });
}
