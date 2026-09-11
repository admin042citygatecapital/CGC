import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { verifyPassword } from '../../../lib/passwordHash.js';
import { findUserByEmail, updateUser, upgradeCustomerPasswordHash } from '../../../lib/userStore.js';
import { createCustomerSession } from '../../../lib/customerSessionStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { appendLoginEvent } from '../../../lib/loginLog.js';
import { sanitizeString, isValidEmail } from '../../../lib/inputValidator.js';
import { isRateLimited } from '../../../lib/rateLimiter.js';
import { CUSTOMER_SESSION_COOKIE, customerSessionCookieOptions } from '../../../lib/customerSessionConfig.js';
import { consumeRecoveryCode, verifyTotp } from '../../../lib/totp.js';
import {
  checkLockout,
  getFailCount,
  recordLoginFailure,
  recordLoginSuccess,
} from '../../../lib/bruteForce.js';
import { getCustomerAccessMode, getCustomerLandingPath } from '../../../lib/customerLifecycleAccess.js';

export default async function handler(req: Request, res: Response) {
  const ip = req.ip ?? 'unknown';
  const ua = req.headers['user-agent'] ?? 'unknown';

  const email    = sanitizeString(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // IP-level rate limit (belt-and-suspenders on top of middleware)
  if (isRateLimited(`user_login_ip:${ip}`, { windowMs: 15 * 60_000, max: 20 })) {
    return res.status(429).json({ error: 'Too many login attempts from your network. Please wait 15 minutes.' });
  }

  // Durable per-account and per-network lockout. State is shared by every
  // application instance and survives restarts.
  const lockout = await checkLockout(email, ip, 'customer');
  if (lockout.blocked) {
    appendAudit({ event: 'user_login_blocked', email, ip, reason: 'account_locked' });
    await appendLoginEvent({ actor: 'user', email, result: 'account_locked', ip, ua, reason: 'account_locked' });
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${lockout.remainingMin} minute(s).` });
  }

  const user = await findUserByEmail(email);

  // PostgreSQL is the single credential authority for customer authentication.
  // Supabase Auth is not part of the production login path; the application
  // stores canonical Argon2id hashes in the Supabase-hosted PostgreSQL users
  // table and issues its own revocable, cookie-bound sessions.
  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$dummysaltfortimingnormalization$dummyhashfortimingnormalization';
  const { ok: passwordOk, rehash } = await verifyPassword(password, user?.passwordHash ?? dummyHash);

  if (!user || !passwordOk) {
    await recordLoginFailure(email, ip, 'customer');
    if (user) await updateUser(user.id, { loginAttempts: await getFailCount(email, 'customer') });
    const reason = user ? 'wrong_password' : 'user_not_found';
    appendAudit({ event: 'user_login_failed', email, ip, reason });
    await appendLoginEvent({ actor: 'user', email, result: 'failed', ip, ua, reason });
    // Generic message — don't reveal whether email exists
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Account status checks
  if (!user.emailVerified) {
    return res.status(403).json({ error: 'Please verify your email address before logging in.', code: 'EMAIL_NOT_VERIFIED' });
  }
  if (user.status === 'pending_verification') {
    return res.status(403).json({ error: 'Please verify your email address before logging in.', code: 'EMAIL_NOT_VERIFIED' });
  }
  if (user.status === 'suspended') {
    await appendLoginEvent({ actor: 'user', email, userId: user.id, result: 'status_denied', ip, ua, reason: 'suspended' });
    return res.status(403).json({ error: 'Your account has been suspended. Please contact support.', code: 'SUSPENDED' });
  }
  if (user.status === 'frozen') {
    await appendLoginEvent({ actor: 'user', email, userId: user.id, result: 'status_denied', ip, ua, reason: 'frozen' });
    return res.status(403).json({ error: 'Your account is temporarily frozen. Please contact support.', code: 'FROZEN' });
  }
  if (user.status === 'rejected') {
    await appendLoginEvent({ actor: 'user', email, userId: user.id, result: 'status_denied', ip, ua, reason: 'rejected' });
    return res.status(403).json({ error: 'Your account application was not approved. Please contact support.', code: 'REJECTED' });
  }

  if (user.totpEnabled) {
    if (isRateLimited(`user_login_otp:${user.id}`, { windowMs: 15 * 60_000, max: 6 })) {
      appendAudit({ event: 'user_login_2fa_blocked', userId: user.id, email, ip });
      return res.status(429).json({ error: 'Too many authentication code attempts. Please wait 15 minutes.', code: 'TWO_FACTOR_LOCKED' });
    }
    if (!user.totpSecret || !otp) {
      return res.status(401).json({ error: 'Enter the code from your authenticator app.', code: 'TWO_FACTOR_REQUIRED' });
    }
    if (!verifyTotp(user.totpSecret, otp)) {
      // Recovery-code fallback: a single-use backup code also satisfies the
      // second factor (lost-device path). It is consumed on success.
      const remainingHashes = user.totpRecoveryHashes
        ? consumeRecoveryCode(user.totpRecoveryHashes, otp)
        : null;
      if (!remainingHashes) {
        await recordLoginFailure(email, ip, 'customer');
        appendAudit({ event: 'user_login_2fa_failed', userId: user.id, email, ip });
        await appendLoginEvent({ actor: 'user', email, userId: user.id, result: 'totp_failed', ip, ua, reason: 'invalid_totp' });
        return res.status(401).json({ error: 'Invalid or expired authentication code.', code: 'INVALID_TWO_FACTOR' });
      }
      await updateUser(user.id, { totpRecoveryHashes: remainingHashes });
      appendAudit({ event: 'user_login_recovery_code_used', userId: user.id, email, ip, meta: { remaining: remainingHashes.length } });
    }
  }

  // Transparent bcrypt/PBKDF2 → Argon2id upgrade. The hash is never returned
  // to the client or written to logs.
  if (rehash) {
    const upgraded = await upgradeCustomerPasswordHash(user.id, user.passwordHash, rehash);
    if (!upgraded) {
      appendAudit({ event: 'user_password_rehash_failed', userId: user.id, email, ip, reason: 'credential_changed' });
      return res.status(401).json({ error: 'Credentials changed. Please log in again.' });
    }
  }

  // Sessions are stored independently of the user record. This preserves
  // multiple-session support and ensures database mode applies expiry rules.
  const now              = new Date().toISOString();

  await recordLoginSuccess(email, ip, 'customer');

  await updateUser(user.id, {
    lastLoginAt:       now,
    lastLoginIp:       ip,
    loginAttempts:     0,
  });
  const sessionToken = await createCustomerSession(user.id, {
    ip,
    ua,
    credentialVersion: user.credentialVersion,
  });
  if (!sessionToken) {
    appendAudit({ event: 'user_login_session_rejected', userId: user.id, email, ip, reason: 'credential_changed' });
    return res.status(401).json({ error: 'Credentials changed. Please log in again.' });
  }

  const accessMode = getCustomerAccessMode(user);
  const nextPath = getCustomerLandingPath(user);
  appendAudit({ event: 'user_login_success', userId: user.id, email, ip, ua, meta: { accessMode } });
  const sessionReference = crypto.createHash('sha256').update(sessionToken).digest('hex');
  await appendLoginEvent({ actor: 'user', email, userId: user.id, result: 'success', ip, ua, sessionId: sessionReference });

  res.cookie(CUSTOMER_SESSION_COOKIE, sessionToken, customerSessionCookieOptions());

  return res.json({
    ok: true,
    accessMode,
    nextPath,
    user: {
      id:        user.id,
      name:      user.name,
      email:     user.email,
      status:    user.status,
      kycStatus: user.kycStatus,
      amlStatus: user.amlStatus ?? 'not_screened',
      amlRiskLevel: user.amlRiskLevel ?? 'unrated',
      ...(accessMode === 'full' ? { balance: user.balance ?? 0 } : {}),
      totpEnabled: user.totpEnabled ?? false,
      accessMode,
    },
  });
}
