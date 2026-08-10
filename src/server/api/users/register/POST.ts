import type { Request, Response } from 'express';
import { hashPassword } from '../../../lib/passwordHash.js';
import {
  createUser, generateVerifyToken, detectDuplicate,
} from '../../../lib/userStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sendVerificationEmail, sendAdminNewUserAlert } from '../../../lib/emailService.js';
import { sanitizeString, isValidEmail, validatePassword } from '../../../lib/inputValidator.js';
import { requirePublicRegistration } from '../../../lib/platformMode.js';
import { issueKycUploadToken } from '../../../lib/purposeToken.js';

const TERMS_VERSION = '2026-08-10';
const PRIVACY_VERSION = '2026-08-10';

function baseUrl(req: Request) {
  const env = process.env.PUBLIC_URL || process.env.SITE_URL;
  if (env) return env.replace(/\/+$/, '');
  return `${req.protocol}://${req.hostname}`;
}

export default async function handler(req: Request, res: Response) {
  if (!requirePublicRegistration(res)) return;
  const raw = req.body as Record<string, unknown>;
  const name     = sanitizeString(raw.name);
  const email    = sanitizeString(raw.email).toLowerCase();
  const password = typeof raw.password === 'string' ? raw.password : '';
  const phone    = sanitizeString(raw.phone);
  const country  = sanitizeString(raw.country);
  const ip       = req.ip ?? 'unknown';
  const termsAccepted = raw.termsAccepted === true;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!termsAccepted) {
    return res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy.' });
  }
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return res.status(400).json({ error: pwCheck.reason });
  }

  // Anti-fraud duplicate detection
  const dup = await detectDuplicate(email, ip);
  if (dup.isDuplicate) {
    appendAudit({ event: 'register_blocked', email, ip, reason: dup.reason });
    if (dup.reason === 'email_exists') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return res.status(429).json({ error: 'Too many registrations from your network. Please try again later.' });
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

  appendAudit({
    event: 'user_registered',
    userId: user.id,
    email,
    ip,
    meta: {
      legalAcceptance: {
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        acceptedAt: new Date().toISOString(),
        method: 'explicit_checkbox',
      },
    },
  });

  const base = baseUrl(req);
  await sendVerificationEmail(email, name, token, base);
  await sendAdminNewUserAlert('admin@citygate.capital', { name, email, country: country || undefined, ip });

  return res.status(201).json({
    ok: true,
    message: 'Registration successful. Please check your email to verify your account.',
    userId: user.id,
    documentUploadToken: process.env.NODE_ENV === 'production' ? undefined : issueKycUploadToken(user.id),
    kycAvailable: process.env.NODE_ENV !== 'production',
  });
}
