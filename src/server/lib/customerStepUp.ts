import type { UserRecord } from './userStore.js';
import { verifyPassword } from './passwordHash.js';
import { verifyTotp } from './totp.js';
import { isRateLimited } from './rateLimiter.js';

export type StepUpResult =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 429; error: string; code: string };

export async function verifyCustomerStepUp(
  user: UserRecord,
  body: Record<string, unknown> | undefined,
): Promise<StepUpResult> {
  if (isRateLimited(`customer_step_up:${user.id}`, { windowMs: 15 * 60_000, max: 8 })) {
    return { ok: false, status: 429, error: 'Too many security verification attempts. Please wait 15 minutes.', code: 'STEP_UP_LOCKED' };
  }

  if (user.totpEnabled) {
    const otp = typeof body?.otp === 'string' ? body.otp.trim() : '';
    if (!otp) return { ok: false, status: 400, error: 'Authenticator code is required.', code: 'OTP_REQUIRED' };
    if (!user.totpSecret || !verifyTotp(user.totpSecret, otp)) {
      return { ok: false, status: 401, error: 'Invalid or expired authentication code.', code: 'INVALID_OTP' };
    }
    return { ok: true };
  }

  const password = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  if (!password) return { ok: false, status: 400, error: 'Current password is required.', code: 'PASSWORD_REQUIRED' };
  const result = await verifyPassword(password, user.passwordHash);
  if (!result.ok) return { ok: false, status: 401, error: 'Security verification failed.', code: 'INVALID_PASSWORD' };
  return { ok: true };
}
