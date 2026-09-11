/**
 * PATCH /api/users/me
 * Allows an authenticated customer to update their own profile.
 * Permitted fields: name, phone, country, walletBtc, walletEth, walletUsdt, walletSol
 * KYC submission: dateOfBirth, address, city, postalCode, idType, idNumber, idDocumentBase64
 *
 * Security hardening:
 *  - wallet addresses validated with safeWalletAddress() per asset
 *  - idType validated against explicit enum allowlist
 *  - all free-text fields sanitized and length-capped
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser, type UserUpdatePatch } from '../../../lib/userStore.js';
import {
  sanitizeString,
  safeWalletAddress,
} from '../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const {
    name, phone, country,
    walletBtc, walletEth, walletUsdt, walletSol,
    // KYC fields
    dateOfBirth, address, city, postalCode, idType, idNumber, idDocumentBase64,
  } = req.body ?? {};

  const patch: UserUpdatePatch = {};

  if (name !== undefined) {
    const trimmed = sanitizeString(name, 100);
    if (!trimmed || trimmed.length < 2)
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    patch.name = trimmed;
  }

  if (phone !== undefined) {
    const trimmed = sanitizeString(phone, 20);
    if (trimmed && !/^\+?[\d\s\-().]{7,20}$/.test(trimmed))
      return res.status(400).json({ error: 'Invalid phone number format.' });
    patch.phone = trimmed;
  }

  if (country !== undefined) patch.country = sanitizeString(country, 100);

  // Wallet addresses — validated per asset
  if (walletBtc !== undefined) {
    const addr = safeWalletAddress('BTC', walletBtc);
    if (addr === null) return res.status(400).json({ error: 'Invalid Bitcoin wallet address.' });
    patch.walletBtc = addr;
  }
  if (walletEth !== undefined) {
    const addr = safeWalletAddress('ETH', walletEth);
    if (addr === null) return res.status(400).json({ error: 'Invalid Ethereum wallet address.' });
    patch.walletEth = addr;
  }
  if (walletUsdt !== undefined) {
    const addr = safeWalletAddress('USDT', walletUsdt);
    if (addr === null) return res.status(400).json({ error: 'Invalid USDT wallet address.' });
    patch.walletUsdt = addr;
  }
  if (walletSol !== undefined) {
    const addr = safeWalletAddress('SOL', walletSol);
    if (addr === null) return res.status(400).json({ error: 'Invalid Solana wallet address.' });
    patch.walletSol = addr;
  }

  // KYC fields — only if not already approved
  const kycFields = [dateOfBirth, address, city, postalCode, idType, idNumber, idDocumentBase64];
  const hasKycData = kycFields.some(f => f !== undefined);

  if (hasKycData) {
    return res.status(410).json({ error: 'Use the secure identity onboarding workflow.', code: 'KYC_WORKFLOW_REQUIRED', href: '/kyc' });
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  const updated = await updateUser(user.id, patch);
  if (!updated) return res.status(500).json({ error: 'Failed to update profile.' });

  return res.json({
    user: {
      id:          updated.id,
      name:        updated.name,
      email:       updated.email,
      phone:       updated.phone     ?? '',
      country:     updated.country   ?? '',
      status:      updated.status,
      kycStatus:   updated.kycStatus,
      amlStatus:   updated.amlStatus ?? 'not_screened',
      amlRiskLevel: updated.amlRiskLevel ?? 'unrated',
      balance:     updated.balance   ?? 0,
      avatarUrl:   updated.avatarUrl ?? '',
      walletBtc:   updated.walletBtc  ?? '',
      walletEth:   updated.walletEth  ?? '',
      walletUsdt:  updated.walletUsdt ?? '',
      walletSol:   updated.walletSol  ?? '',
      dateOfBirth: updated.dateOfBirth ?? '',
      address:     updated.address     ?? '',
      city:        updated.city        ?? '',
      postalCode:  updated.postalCode  ?? '',
      idType:      updated.idType      ?? '',
      idNumber:    updated.idNumber    ?? '',
      kycSubmittedAt: updated.kycSubmittedAt ?? '',
    },
  });
}
