import type { Request, Response } from 'express';
import { verifyPassword } from '../../../lib/passwordHash.js';
import { findUserByEmail, updateUser } from '../../../lib/userStore.js';
import { createCustomerSession } from '../../../lib/customerSessionStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { appendLoginEvent } from '../../../lib/loginLog.js';
import { sanitizeString, isValidEmail } from '../../../lib/inputValidator.js';
import { isRateLimited } from '../../../lib/rateLimiter.js';

// Per-email brute-force lockout (separate from IP rate limit)
const failMap = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 6;
const LOCKOUT_MS   = 15 * 60 * 1000;

export default async function handler(req: Request, res: Response) {
  const ip = req.ip ?? 'unknown';
  const ua = req.headers['user-agent'] ?? 'unknown';

  const email    = sanitizeString(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

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

  // Per-email lockout
  const lockKey = `user_login:${email}`;
  const fail = failMap.get(lockKey);
  if (fail && fail.lockedUntil > Date.now()) {
    const remaining = Math.ceil((fail.lockedUntil - Date.now()) / 60000);
    appendAudit({ event: 'user_login_blocked', email, ip, reason: 'account_locked' });
    await appendLoginEvent({ actor: 'user', email, result: 'account_locked', ip, ua, reason: 'account_locked' });
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${remaining} minute(s).` });
  }

  const user = await findUserByEmail(email);

  // Constant-time comparison even when user not found (prevents timing attacks)
  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$dummysaltfortimingnormalization$dummyhashfortimingnormalization';
  const hashToCheck = user?.passwordHash ?? dummyHash;
  const { ok: passwordOk, rehash } = await verifyPassword(password, hashToCheck);

  if (!user || !passwordOk) {
    const current = failMap.get(lockKey) ?? { count: 0, lockedUntil: 0 };
    current.count += 1;
    if (current.count >= MAX_ATTEMPTS) current.lockedUntil = Date.now() + LOCKOUT_MS;
    failMap.set(lockKey, current);
    const reason = user ? 'wrong_password' : 'user_not_found';
    appendAudit({ event: 'user_login_failed', email, ip, reason });
    await appendLoginEvent({ actor: 'user', email, result: 'failed', ip, ua, reason });
    // Generic message — don't reveal whether email exists
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Reset fail counter
  failMap.delete(lockKey);

  // Transparent bcrypt → Argon2id upgrade: persist new hash if provided
  if (rehash && user) {
    await updateUser(user.id, { passwordHash: rehash });
  }

  // Account status checks
  if (!user.emailVerified) {
    return res.status(403).json({ error: 'Please verify your email address before logging in.', code: 'EMAIL_NOT_VERIFIED' });
  }
  if (user.status === 'pending_verification' || user.status === 'pending_kyc') {
    return res.status(403).json({ error: 'Your account is pending verification. Please complete KYC.', code: 'PENDING_KYC' });
  }
  if (user.status === 'pending_approval') {
    return res.status(403).json({ error: 'Your account is awaiting admin approval.', code: 'PENDING_APPROVAL' });
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

  // Sessions are stored independently of the user record. This preserves
  // multiple-session support and ensures database mode applies expiry rules.
  const now              = new Date().toISOString();

  await updateUser(user.id, {
    lastLoginAt:       now,
    lastLoginIp:       ip,
    loginAttempts:     0,
  });
  const sessionToken = await createCustomerSession(user.id, { ip, ua });

  appendAudit({ event: 'user_login_success', userId: user.id, email, ip, ua });
  await appendLoginEvent({ actor: 'user', email, userId: user.id, result: 'success', ip, ua, sessionId: sessionToken.slice(0, 8) });

  return res.json({
    ok: true,
    token: sessionToken,
    user: {
      id:        user.id,
      name:      user.name,
      email:     user.email,
      status:    user.status,
      kycStatus: user.kycStatus,
      amlStatus: user.amlStatus ?? 'not_screened',
      amlRiskLevel: user.amlRiskLevel ?? 'unrated',
      balance:   user.balance ?? 0,
    },
  });
}
