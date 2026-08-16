import type { Request, Response } from 'express';
import { hashPassword } from '../../../lib/passwordHash.js';
import {
  createUserWithRegistrationCase, generateVerifyToken, detectDuplicate,
} from '../../../lib/userStore.js';
import { buildRegistrationWorkflow } from '../../../lib/registrationWorkflow.js';
import { getRegistrationIntakePosition } from '../../../lib/onboardingStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sendVerificationEmail, sendAdminNewUserAlert } from '../../../lib/emailService.js';
import { sanitizeString, isValidEmail, validatePassword } from '../../../lib/inputValidator.js';
import { requirePublicRegistration } from '../../../lib/platformMode.js';
import { issueKycUploadToken } from '../../../lib/purposeToken.js';
import { getProductBySlug } from '../../../../lib/productCatalogue.js';
import { requireIntakeEnabled } from '../../../lib/operationalControls.js';

const TERMS_VERSION = '2026-08-10';
const PRIVACY_VERSION = '2026-08-10';

function baseUrl(req: Request) {
  const env = process.env.PUBLIC_URL || process.env.SITE_URL;
  if (env) return env.replace(/\/+$/, '');
  return `${req.protocol}://${req.hostname}`;
}

export default async function handler(req: Request, res: Response) {
  if (!requirePublicRegistration(res)) return;
  if (!requireIntakeEnabled(res, 'accountApplicationsEnabled')) return;
  const raw = req.body as Record<string, unknown>;
  const name     = sanitizeString(raw.name);
  const email    = sanitizeString(raw.email).toLowerCase();
  const password = typeof raw.password === 'string' ? raw.password : '';
  const phone    = sanitizeString(raw.phone);
  const country  = sanitizeString(raw.country);
  const address  = sanitizeString(raw.address);
  const city     = sanitizeString(raw.city);
  const postalCode = sanitizeString(raw.postalCode);
  const product = getProductBySlug(raw.requestedProduct);
  const ip       = req.ip ?? 'unknown';
  const termsAccepted = raw.termsAccepted === true;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (!phone || !country || !address || !city || !postalCode) {
    return res.status(400).json({ error: 'Phone, country, address, city and postal code are required.' });
  }
  if (!product) {
    return res.status(400).json({ error: 'Select a valid City Gate Capital service.' });
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

  const caseType = product.accountTier === 'business' ? 'business' : 'individual';
  const { user, applicationReference } = await createUserWithRegistrationCase({
    email,
    name,
    phone: phone || undefined,
    country: country || undefined,
    address,
    city,
    postalCode,
    accountTier: product.accountTier,
    requestedProduct: product.slug,
    status: 'pending_verification',
    kycStatus: 'not_submitted',
    emailVerified: false,
    emailVerifyToken: token,
    emailVerifyExpiry: expiry,
    passwordHash,
    ip,
  }, caseType);

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
      requestedProduct: product.slug,
      accountTier: product.accountTier,
      applicationReference,
    },
  });

  const base = baseUrl(req);
  await sendVerificationEmail(email, name, token, base);
  await sendAdminNewUserAlert('admin@citygate.capital', { name, email, country: country || undefined, ip });

  const intakePosition = applicationReference ? await getRegistrationIntakePosition(applicationReference) : null;
  return res.status(201).json({
    ok: true,
    message: 'Registration successful. Please check your email to verify your account.',
    userId: user.id,
    applicationReference,
    intakePosition,
    workflow: buildRegistrationWorkflow(user, { status: 'draft' }, 0, null),
    documentUploadToken: process.env.NODE_ENV === 'production' ? undefined : issueKycUploadToken(user.id),
    kycAvailable: process.env.NODE_ENV !== 'production',
  });
}
