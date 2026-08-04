/**
 * GET /api/users/profile
 * Returns the authenticated customer's own editable profile fields —
 * the read counterpart to PATCH /api/users/me / PUT /api/users/profile.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  return res.json({
    ok: true,
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      country: user.country ?? '',
      avatarUrl: user.avatarUrl ?? null,
      status: user.status,
      kycStatus: user.kycStatus,
      bankName: user.bankName ?? '',
      bankAccountNumber: user.bankAccountNumber ?? '',
      bankRoutingNumber: user.bankRoutingNumber ?? '',
      bankSwift: user.bankSwift ?? '',
      bankIban: user.bankIban ?? '',
      walletBtc: user.walletBtc ?? '',
      walletEth: user.walletEth ?? '',
      walletUsdt: user.walletUsdt ?? '',
    },
  });
}
