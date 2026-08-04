/**
 * beneficiaries.ts — shared type + validation for customer beneficiaries.
 *
 * Beneficiaries have no dedicated table/store — they're persisted as a JSON
 * array directly on UserRecord.beneficiaries (userStore.ts), which was
 * already typed as an opaque `unknown` field for exactly this purpose. This
 * module just centralizes the shape and a couple of small helpers so the
 * four users/beneficiaries/* routes don't duplicate them.
 */
import crypto from 'node:crypto';
import { sanitizeString, safeWalletAddress } from './inputValidator.js';

export type BeneficiaryType = 'bank' | 'crypto';

export interface Beneficiary {
  id:             string;
  type:           BeneficiaryType;
  name:           string;
  nickname?:      string;
  currency?:      string;
  // Bank fields
  bankName?:      string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?:     string;
  // Crypto fields
  asset?:         string; // BTC | ETH | USDT | BNB | SOL
  network?:       string;
  walletAddress?: string;
  createdAt:      string;
  updatedAt:      string;
}

export interface BeneficiaryValidationError {
  ok: false;
  error: string;
}

/**
 * Validate + sanitize a beneficiary creation payload. Returns the built
 * Beneficiary (minus id/createdAt/updatedAt) or a validation error.
 */
export function buildBeneficiary(raw: Record<string, unknown>):
  | { ok: true; data: Omit<Beneficiary, 'id' | 'createdAt' | 'updatedAt'> }
  | BeneficiaryValidationError {
  const type = raw.type === 'crypto' ? 'crypto' : raw.type === 'bank' ? 'bank' : null;
  if (!type) return { ok: false, error: "type must be 'bank' or 'crypto'" };

  const name = sanitizeString(raw.name, 200);
  if (!name) return { ok: false, error: 'name is required' };

  const nickname = raw.nickname !== undefined ? sanitizeString(raw.nickname, 100) : undefined;
  const currency = raw.currency !== undefined ? sanitizeString(raw.currency, 10).toUpperCase() : undefined;

  if (type === 'bank') {
    const bankName = sanitizeString(raw.bankName, 200);
    const accountNumber = sanitizeString(raw.accountNumber, 50);
    if (!bankName || !accountNumber) {
      return { ok: false, error: 'bankName and accountNumber are required for a bank beneficiary' };
    }
    return {
      ok: true,
      data: {
        type, name, nickname, currency,
        bankName, accountNumber,
        routingNumber: raw.routingNumber !== undefined ? sanitizeString(raw.routingNumber, 50) : undefined,
        swiftCode: raw.swiftCode !== undefined ? sanitizeString(raw.swiftCode, 20) : undefined,
      },
    };
  }

  const asset = sanitizeString(raw.asset, 10).toUpperCase();
  const address = safeWalletAddress(asset, raw.walletAddress);
  if (!asset || address === null || address === '') {
    return { ok: false, error: 'A valid asset and walletAddress are required for a crypto beneficiary' };
  }
  return {
    ok: true,
    data: {
      type, name, nickname, currency,
      asset, walletAddress: address,
      network: raw.network !== undefined ? sanitizeString(raw.network, 50) : undefined,
    },
  };
}

export function newBeneficiaryId(): string {
  return 'ben_' + crypto.randomBytes(8).toString('hex');
}
