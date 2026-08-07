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
import fs from 'node:fs';
import path from 'node:path';
import { findUserBySessionToken, updateUser } from '../../../lib/userStore.js';
import {
  sanitizeString,
  isOneOf,
  safeWalletAddress,
} from '../../../lib/inputValidator.js';
import { privateSubdirectory } from '../../../lib/storagePaths.js';

const KYC_DOC_DIR = privateSubdirectory('kyc-documents');
const VALID_ID_TYPES = ['passport','national_id','drivers_license','residence_permit'] as const;

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

  const patch: Record<string, unknown> = {};

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
    if (user.kycStatus === 'approved') {
      return res.status(400).json({ error: 'KYC is already approved and cannot be resubmitted.' });
    }

    if (dateOfBirth !== undefined) patch.dateOfBirth = sanitizeString(dateOfBirth, 20);
    if (address     !== undefined) patch.address     = sanitizeString(address, 300);
    if (city        !== undefined) patch.city        = sanitizeString(city, 100);
    if (postalCode  !== undefined) patch.postalCode  = sanitizeString(postalCode, 20);
    if (idType      !== undefined) {
      const safeIdType = isOneOf(idType, VALID_ID_TYPES);
      if (!safeIdType) return res.status(400).json({ error: `idType must be one of: ${VALID_ID_TYPES.join(', ')}` });
      patch.idType = safeIdType;
    }
    if (idNumber    !== undefined) patch.idNumber    = sanitizeString(idNumber, 50);

    // Handle ID document upload
    if (idDocumentBase64) {
      const match = String(idDocumentBase64).match(/^data:(image\/(?:jpeg|png|gif|webp|pdf));base64,(.+)$/);
      if (!match) return res.status(400).json({ error: 'Invalid document format.' });
      const [, mimeType, b64data] = match;
      const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
      const byteSize = Math.ceil(b64data.length * 0.75);
      if (byteSize > 5 * 1024 * 1024) return res.status(400).json({ error: 'Document too large. Max 5MB.' });

      try {
        if (!fs.existsSync(KYC_DOC_DIR)) fs.mkdirSync(KYC_DOC_DIR, { recursive: true });
        const filename = `${user.id}-id-profile.${ext}`;
        for (const oldFile of fs.readdirSync(KYC_DOC_DIR).filter(file => file.startsWith(`${user.id}-id-`))) {
          fs.unlinkSync(path.join(KYC_DOC_DIR, oldFile));
        }
        fs.writeFileSync(path.join(KYC_DOC_DIR, filename), Buffer.from(b64data, 'base64'), { mode: 0o600 });
        patch.idDocumentUrl = `/api/admin/kyc/document?userId=${encodeURIComponent(user.id)}&kind=id`;
      } catch (err) {
        return res.status(500).json({ error: 'Failed to save document: ' + String(err) });
      }
    }

    // If all required KYC fields are present, set status to submitted
    const merged = { ...user, ...patch };
    if (merged.dateOfBirth && merged.address && merged.idType && merged.idNumber) {
      patch.kycStatus = 'submitted';
      patch.kycSubmittedAt = new Date().toISOString();
    }
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  const updated = await updateUser(user.id, patch as any);
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
      balance:     updated.balance   ?? 0,
      avatarUrl:   (updated as any).avatarUrl ?? '',
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
