/**
 * POST /api/admin/users/create
 * SUPER_ADMIN creates a pending customer registration record that must still
 * complete email verification, onboarding, and compliance review.
 */
import type { Request, Response } from 'express';
import { hashPassword } from '../../../../lib/passwordHash.js';
import { createUserWithRegistrationCase, findUserByEmail, generateVerifyToken } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { authorizeAdminRole, authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';
import { isValidEmail, sanitizeNote, sanitizeString, validatePassword } from '../../../../lib/inputValidator.js';
import { sendVerificationEmail } from '../../../../lib/emailService.js';
import { getProductBySlug } from '../../../../../lib/productCatalogue.js';

export default async function handler(req: Request, res: Response) {
  if (!authorizeAdminRole(req, res, 'SUPER_ADMIN')) return;
  const session = req.adminSession!;
  const {
    name: rawName, email: rawEmail, phone: rawPhone, country: rawCountry, password,
    address: rawAddress, city: rawCity, postalCode: rawPostalCode,
    requestedProduct, reason, confirmed,
  } = req.body as Record<string, unknown>;

  const name = sanitizeString(rawName);
  const email = sanitizeString(rawEmail).toLowerCase();
  const phone = sanitizeString(rawPhone);
  const country = sanitizeString(rawCountry);
  const address = sanitizeString(rawAddress);
  const city = sanitizeString(rawCity);
  const postalCode = sanitizeString(rawPostalCode);
  const safeReason = sanitizeNote(reason);
  const product = getProductBySlug(requestedProduct);

  if (!name || !email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Name, email and temporary password are required.' });
  }
  if (!phone || !country || !address || !city || !postalCode) {
    return res.status(400).json({ error: 'Phone, country, address, city and postal code are required.' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.reason });
  if (!product) return res.status(400).json({ error: 'Select a valid registration product.' });
  if (confirmed !== true) return res.status(400).json({ error: 'Explicit confirmation is required.' });
  if (safeReason.length < 10) return res.status(400).json({ error: 'An administration reason of at least 10 characters is required.' });
  if (!authorizeRecentAdminStepUp(req, res)) return;

  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await hashPassword(password);
  const { token, expiry } = generateVerifyToken();

  await appendCriticalAudit({
    event: 'admin_user_create_intent',
    adminId: session.adminId,
    email: session.email,
    ip: req.ip,
    reason: safeReason,
    meta: { targetEmail: email, requestedProduct: product.slug, accountTier: product.accountTier },
  });

  const created = await createUserWithRegistrationCase({
    name,
    email,
    phone,
    country,
    address,
    city,
    postalCode,
    passwordHash,
    status: 'pending_verification',
    kycStatus: 'not_submitted',
    emailVerified: false,
    emailVerifyToken: token,
    emailVerifyExpiry: expiry,
    accountTier: product.accountTier,
    requestedProduct: product.slug,
    ip: req.ip ?? 'unknown',
  }, product.accountTier === 'business' ? 'business' : 'individual');
  const { user, applicationReference } = created;

  const siteUrl = (process.env.PUBLIC_URL || process.env.SITE_URL || `${req.protocol}://${req.hostname}`).replace(/\/+$/, '');
  await sendVerificationEmail(user.email, user.name, token, siteUrl);

  appendAudit({
    event: 'admin_user_created',
    adminId: session.adminId,
    userId: user.id,
    email: user.email,
    ip: req.ip,
    reason: safeReason,
    meta: { name: user.name, status: user.status, kycStatus: user.kycStatus, accountTier: user.accountTier, requestedProduct: product.slug, applicationReference },
  });

  return res.status(201).json({
    ok: true,
    userId: user.id,
    applicationReference,
    message: `Registration record created for ${user.name}. Email verification is required.`,
  });
}
