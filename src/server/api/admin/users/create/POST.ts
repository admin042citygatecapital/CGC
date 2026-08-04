/**
 * POST /api/admin/users/create
 * SUPER_ADMIN creates a new customer account directly.
 */
import type { Request, Response } from 'express';
import { hashPassword } from '../../../../lib/passwordHash.js';
import { createUser, findUserByEmail } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isValidEmail, validatePassword, isOneOf } from '../../../../lib/inputValidator.js';

const STATUSES = ['pending_verification', 'pending_kyc', 'pending_approval', 'active', 'suspended', 'frozen', 'rejected'] as const;
const KYC_STATUSES = ['not_submitted', 'submitted', 'approved', 'rejected'] as const;
const TIERS = ['personal', 'savings', 'business'] as const;

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const {
    name, email, phone, country, password,
    status = 'active',
    kycStatus = 'not_submitted',
    accountTier = 'personal',
    primaryCurrency = 'USD',
    balance = 0,
  } = req.body as Record<string, unknown>;

  const safeName = sanitizeString(name, 200);
  const safeEmail = sanitizeString(email, 200).toLowerCase();
  if (!safeName || !safeEmail || !password) {
    return res.status(400).json({ ok: false, error: 'name, email and password are required' });
  }
  if (!isValidEmail(safeEmail)) return res.status(400).json({ ok: false, error: 'Invalid email' });

  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) return res.status(400).json({ ok: false, error: pwCheck.reason ?? 'Weak password' });

  const safeStatus = isOneOf(status, STATUSES) ?? 'active';
  const safeKyc = isOneOf(kycStatus, KYC_STATUSES) ?? 'not_submitted';
  const safeTier = isOneOf(accountTier, TIERS) ?? 'personal';

  const existing = await findUserByEmail(safeEmail);
  if (existing) return res.status(409).json({ ok: false, error: 'Email already registered' });

  const passwordHash = await hashPassword(String(password));

  const user = await createUser({
    name: safeName,
    email: safeEmail,
    phone: phone ? sanitizeString(phone, 50) : undefined,
    country: country ? sanitizeString(country, 100) : undefined,
    passwordHash,
    status: safeStatus,
    kycStatus: safeKyc,
    emailVerified: true, // admin-created accounts skip email verification
    accountTier: safeTier,
    primaryCurrency: sanitizeString(primaryCurrency, 10) || 'USD',
    balance: Number(balance) || 0,
  });

  appendAudit({
    event: 'admin_user_created',
    adminId: session.adminId,
    userId: user.id,
    email: user.email,
    ip: req.ip ?? 'unknown',
    meta: { name: user.name, status: safeStatus, kycStatus: safeKyc, accountTier: safeTier },
  });

  return res.status(201).json({ ok: true, userId: user.id, message: `Account created for ${user.name}` });
}
