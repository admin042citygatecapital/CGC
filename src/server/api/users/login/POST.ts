/**
 * POST /api/users/login
 *
 * Body: { email, password }
 *
 * Reworked against the current backend (see AUDIT_REPORT / PR #4 notes):
 *  - Password verification goes through passwordHash.ts (Argon2id, with
 *    transparent bcrypt/PBKDF2 legacy-hash upgrade) instead of bcryptjs
 *    directly, matching every other password check in this codebase.
 *  - Brute-force lockout goes through the shared, DB-backed bruteForce.ts
 *    (exponential backoff, per-email + per-IP) instead of a local in-memory
 *    Map, matching admin/auth/login/POST.ts.
 *  - Session issuance goes through customerSessionStore.createCustomerSession
 *    so the token is looked up the same way by users/session/GET.ts and
 *    users/logout/POST.ts (via userStore's findUserBySessionToken shim) in
 *    both DB-backed and flat-file-fallback modes.
 */
import type { Request, Response } from 'express';
import { findUserByEmail, updateUser } from '../../../lib/userStore.js';
import { createCustomerSession } from '../../../lib/customerSessionStore.js';
import { verifyPassword } from '../../../lib/passwordHash.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { appendLoginEvent } from '../../../lib/loginLog.js';
import { sanitizeString, isValidEmail } from '../../../lib/inputValidator.js';
import { isRateLimited } from '../../../lib/rateLimiter.js';
import { checkLockout, recordLoginFailure, recordLoginSuccess } from '../../../lib/bruteForce.js';

export default async function handler(req: Request, res: Response) {
  const ip = req.ip ?? 'unknown';
  const ua = req.headers['user-agent'] ?? 'unknown';

  const email = sanitizeString(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address' });
  }

  // IP-level rate limit (short-window burst protection, separate from lockout)
  if (isRateLimited(`user_login_ip:${ip}`, { windowMs: 15 * 60_000, max: 20 })) {
    return res.status(429).json({ ok: false, error: 'Too many login attempts from your network. Please wait 15 minutes.' });
  }

  // Per-email + per-IP exponential-backoff lockout
  const lockout = await checkLockout(email, ip);
  if (lockout.blocked) {
    try { appendAudit({ event: 'user_login_blocked', email, ip, reason: 'brute_force_lockout' }); } catch { /* non-critical: audit/log-event failures must not block the response */ }
    try { await appendLoginEvent('user', email, 'account_locked', ip, String(ua), { reason: 'brute_force_lockout' }); } catch { /* non-critical: audit/log-event failures must not block the response */ }
    return res.status(429).json({ ok: false, error: `Too many failed attempts. Try again in ${lockout.remainingMin} minute(s).` });
  }

  const user = await findUserByEmail(email);

  // Constant-time-ish comparison even when user not found (prevents timing-based enumeration)
  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const hashToCheck = user?.passwordHash ?? dummyHash;
  const { ok: passwordOk, rehash } = await verifyPassword(password, hashToCheck);

  if (!user || !passwordOk) {
    await recordLoginFailure(email, ip);
    const reason = user ? 'wrong_password' : 'user_not_found';
    try { appendAudit({ event: 'user_login_failed', email, ip, reason }); } catch { /* non-critical: audit/log-event failures must not block the response */ }
    try { await appendLoginEvent('user', email, 'failed', ip, String(ua), { reason }); } catch { /* non-critical: audit/log-event failures must not block the response */ }
    return res.status(401).json({ ok: false, error: 'Invalid email or password' });
  }

  await recordLoginSuccess(email, ip);

  // Account status checks
  if (!user.emailVerified) {
    return res.status(403).json({ ok: false, error: 'Please verify your email address before logging in.', code: 'EMAIL_NOT_VERIFIED' });
  }
  if (user.status === 'pending_verification' || user.status === 'pending_kyc') {
    return res.status(403).json({ ok: false, error: 'Your account is pending verification. Please complete KYC.', code: 'PENDING_KYC' });
  }
  if (user.status === 'pending_approval') {
    return res.status(403).json({ ok: false, error: 'Your account is awaiting admin approval.', code: 'PENDING_APPROVAL' });
  }
  if (user.status === 'suspended') {
    try { await appendLoginEvent('user', email, 'status_denied', ip, String(ua), { userId: user.id, reason: 'suspended' }); } catch { /* non-critical: audit/log-event failures must not block the response */ }
    return res.status(403).json({ ok: false, error: 'Your account has been suspended. Please contact support.', code: 'SUSPENDED' });
  }
  if (user.status === 'frozen') {
    try { await appendLoginEvent('user', email, 'status_denied', ip, String(ua), { userId: user.id, reason: 'frozen' }); } catch { /* non-critical: audit/log-event failures must not block the response */ }
    return res.status(403).json({ ok: false, error: 'Your account is temporarily frozen. Please contact support.', code: 'FROZEN' });
  }
  if (user.status === 'rejected') {
    try { await appendLoginEvent('user', email, 'status_denied', ip, String(ua), { userId: user.id, reason: 'rejected' }); } catch { /* non-critical: audit/log-event failures must not block the response */ }
    return res.status(403).json({ ok: false, error: 'Your account application was not approved. Please contact support.', code: 'REJECTED' });
  }

  // Issue session — works for both DB-backed (customer_sessions table) and
  // flat-file (sessionToken column on the user record) lookup paths.
  const sessionToken = await createCustomerSession(user.id, { ip, ua: String(ua) });

  const patch: Record<string, unknown> = {
    lastLoginAt: new Date().toISOString(),
    lastLoginIp: ip,
    loginAttempts: 0,
    sessionToken,
  };
  // Persist the bcrypt/PBKDF2 → Argon2id upgrade transparently, if one occurred
  if (rehash) patch.passwordHash = rehash;
  await updateUser(user.id, patch as never);

  try { appendAudit({ event: 'user_login_success', userId: user.id, email, ip, ua }); } catch { /* non-critical: audit/log-event failures must not block the response */ }
  try { await appendLoginEvent('user', email, 'success', ip, String(ua), { userId: user.id, sessionId: sessionToken.slice(0, 8) }); } catch { /* non-critical: audit/log-event failures must not block the response */ }

  return res.json({
    ok: true,
    token: sessionToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      kycStatus: user.kycStatus,
    },
  });
}
