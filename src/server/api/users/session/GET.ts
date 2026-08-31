/**
 * GET /api/users/session
 * Verifies the secure customer session cookie.
 * Returns the user object if valid, 401 if not.
 * Completely separate from /api/admin/auth/verify — no admin state shared.
 */
import type { Request, Response } from 'express';
import { getCustomerAccessMode, getCustomerLandingPath } from '../../../lib/customerLifecycleAccess.js';
export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const accessMode = getCustomerAccessMode(user);
  const nextPath = getCustomerLandingPath(user);
  return res.json({
    accessMode,
    nextPath,
    user: {
      id:        user.id,
      name:      user.name,
      email:     user.email,
      phone:     user.phone     ?? '',
      country:   user.country   ?? '',
      status:    user.status,
      kycStatus: user.kycStatus,
      amlStatus: user.amlStatus ?? 'not_screened',
      amlRiskLevel: user.amlRiskLevel ?? 'unrated',
      ...(accessMode === 'full' ? {
        balance: user.balance ?? 0,
        avatarUrl: user.avatarUrl ?? '',
        walletBtc: user.walletBtc ?? '',
        walletEth: user.walletEth ?? '',
        walletUsdt: user.walletUsdt ?? '',
        walletSol: user.walletSol ?? '',
      } : {}),
      // KYC fields
      dateOfBirth: user.dateOfBirth ?? '',
      address:     user.address     ?? '',
      city:        user.city        ?? '',
      postalCode:  user.postalCode  ?? '',
      idType:      user.idType      ?? '',
      idNumber:    user.idNumber    ?? '',
      kycSubmittedAt: user.kycSubmittedAt ?? '',
      // Admin-assigned primary display currency
      primaryCurrency: user.primaryCurrency ?? 'USD',
      totpEnabled: user.totpEnabled ?? false,
      accessMode,
    },
  });
}
