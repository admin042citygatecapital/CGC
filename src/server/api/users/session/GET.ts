/**
 * GET /api/users/session
 * Verifies a customer session token (Authorization: Bearer <token>).
 * Returns the user object if valid, 401 if not.
 * Completely separate from /api/admin/auth/verify — no admin state shared.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const user = await findUserBySessionToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  return res.json({
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
      balance:   user.balance ?? 0,
      avatarUrl: user.avatarUrl ?? '',
      // Crypto withdrawal addresses
      walletBtc:  user.walletBtc  ?? '',
      walletEth:  user.walletEth  ?? '',
      walletUsdt: user.walletUsdt ?? '',
      walletSol:  user.walletSol  ?? '',
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
    },
  });
}
