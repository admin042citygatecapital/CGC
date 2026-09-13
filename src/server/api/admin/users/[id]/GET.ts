import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'User ID required' });

  // Optional chaining keeps this fail-closed: a missing session simply
  // withholds the financial summary rather than throwing.
  const role = req.adminSession?.role;
  const mayViewFinancialSummary = role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN';

  const user = await findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Mirrors the directory projection in users/GET.ts so the detail drawer shows
  // the same fields whether it is opened from the list or via a deep link.
  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    country: user.country,
    status: user.status,
    kycStatus: user.kycStatus,
    amlStatus: user.amlStatus ?? 'not_screened',
    amlRiskLevel: user.amlRiskLevel ?? 'unrated',
    amlNextReviewAt: user.amlNextReviewAt,
    emailVerified: user.emailVerified,
    ...(mayViewFinancialSummary ? { balance: user.balance ?? 0, primaryCurrency: user.primaryCurrency ?? 'USD' } : {}),
    createdAt: user.createdAt,
    approvedAt: user.approvedAt,
    rejectedAt: user.rejectedAt,
    rejectionReason: user.rejectionReason,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    // KYC fields
    dateOfBirth: user.dateOfBirth,
    address: user.address,
    city: user.city,
    postalCode: user.postalCode,
    idType: user.idType,
    kycSubmittedAt: user.kycSubmittedAt,
    kycRejectionReason: user.kycRejectionReason,
    // Raw document locations, identity numbers, bank credentials and wallet
    // addresses are deliberately excluded from the general directory.
    accountTier: user.accountTier ?? 'personal',
    dataClassification: 'customer_support_profile',
  });
}
