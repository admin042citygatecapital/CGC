/**
 * POST /api/users/register
 *
 * Reworked against the current backend: password hashing goes through
 * passwordHash.ts (Argon2id) instead of bcryptjs directly, and the
 * now-async userStore/detectDuplicate calls are properly awaited (the
 * Drizzle-backed userStore.ts made every one of these functions async;
 * the original code, written against the flat-file-only store, called
 * them synchronously).
 */
import type { Request, Response } from 'express';
import {
  createUser, generateVerifyToken, detectDuplicate,
} from '../../../lib/userStore.js';
import { hashPassword } from '../../../lib/passwordHash.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sendVerificationEmail, sendAdminNewUserAlert } from '../../../lib/emailService.js';
import { sanitizeString, isValidEmail, validatePassword } from '../../../lib/inputValidator.js';

function baseUrl(req: Request) {
  const env = process.env.PUBLIC_URL || process.env.SITE_URL;
  if (env) return env.replace(/\/+$/, '');
  return `${req.protocol}://${req.hostname}`;
}

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const name     = sanitizeString(raw.name);
  const email    = sanitizeString(raw.email).toLowerCase();
  const password = typeof raw.password === 'string' ? raw.password : '';
  const phone    = sanitizeString(raw.phone);
  const country  = sanitizeString(raw.country);
  const ip       = req.ip ?? 'unknown';

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, error: 'Name, email and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address' });
  }
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return res.status(400).json({ ok: false, error: pwCheck.reason });
  }

  // Anti-fraud duplicate detection
  const dup = await detectDuplicate(email, ip);
  if (dup.isDuplicate) {
    appendAudit({ event: 'register_blocked', email, ip, reason: dup.reason });
    if (dup.reason === 'email_exists') {
      return res.status(409).json({ ok: false, error: 'An account with this email already exists.' });
    }
    return res.status(429).json({ ok: false, error: 'Too many registrations from your network. Please try again later.' });
  }

  const { token, expiry } = generateVerifyToken();
  const passwordHash = await hashPassword(password);

  const user = await createUser({
    email,
    name,
    phone: phone || undefined,
    country: country || undefined,
    status: 'pending_verification',
    kycStatus: 'not_submitted',
    emailVerified: false,
    emailVerifyToken: token,
    emailVerifyExpiry: expiry,
    passwordHash,
    ip,
  });

  appendAudit({ event: 'user_registered', userId: user.id, email, ip });

  const base = baseUrl(req);
  await sendVerificationEmail(email, name, token, base);
  await sendAdminNewUserAlert('admin@citygate.capital', { name, email, country: country || undefined, ip });

  return res.status(201).json({
    ok: true,
    message: 'Registration successful. Please check your email to verify your account.',
    userId: user.id,
  });
}
