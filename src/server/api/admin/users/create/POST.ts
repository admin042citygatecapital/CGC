/**
 * POST /api/admin/users/create
 * Super Admin creates a new customer account directly.
 */
import type { Request, Response } from 'express';
import { hashPassword } from '../../../../lib/passwordHash.js';
import { createUser, findUserByEmail } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { requireFinancialOperations } from '../../../../lib/platformMode.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const {
    name, email, phone, country, password,
    status = 'active',
    kycStatus = 'not_submitted',
    accountTier = 'personal',
    primaryCurrency = 'USD',
    balance = 0,
  } = req.body as Record<string, string | number>;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (Number(balance) !== 0 && !requireFinancialOperations(res)) return;

  const existing = await findUserByEmail(String(email));
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await hashPassword(String(password));

  await appendCriticalAudit({
    event: 'admin_user_create_intent',
    adminId: session.adminId,
    email: session.email,
    ip: req.ip,
    meta: { targetEmail: String(email).toLowerCase().trim(), status, kycStatus, accountTier },
  });

  const user = await createUser({
    name: String(name),
    email: String(email).toLowerCase().trim(),
    phone: phone ? String(phone) : undefined,
    country: country ? String(country) : undefined,
    passwordHash,
    status: status as never,
    kycStatus: kycStatus as never,
    emailVerified: true,   // admin-created accounts skip email verification
    accountTier: (accountTier as 'personal' | 'savings' | 'business') ?? 'personal',
    primaryCurrency: String(primaryCurrency),
    balance: Number(balance) || 0,
  });

  appendAudit({
    event: 'admin_user_created',
    adminId: session.adminId,
    userId: user.id,
    email: user.email,
    ip: req.ip,
    meta: { name: user.name, status, kycStatus, accountTier },
  });

  return res.status(201).json({ ok: true, userId: user.id, message: `Account created for ${user.name}` });
}
