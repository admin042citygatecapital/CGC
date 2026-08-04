/**
 * customerTransfer.ts — shared logic for users/transfer and users/transfers
 * POST (both create a customer-initiated transfer the same way; entry.ts
 * expects both routes to exist, so this avoids duplicating the fee/balance/
 * transaction-creation logic between them).
 *
 * Same "pending until admin approval" model as users/deposit and
 * users/withdraw — see those files for why the balance isn't touched here.
 */
import type { UserRecord } from './userStore.js';
import { createTransaction, type Transaction } from './transactionStore.js';
import { readRatesConfig, toUsd } from './ratesStore.js';
import type { Beneficiary } from './beneficiaries.js';
import { sanitizeString } from './inputValidator.js';

export interface TransferRequest {
  currency?: string;
  amount?: number;
  beneficiaryId?: string;
  note?: string;
}

export type TransferResult =
  | { ok: true; transaction: Transaction; fee: number }
  | { ok: false; status: number; error: string };

function computeFee(amount: number, flat: number, pct: number, min: number, max: number): number {
  let fee = flat + amount * (pct / 100);
  if (min > 0) fee = Math.max(fee, min);
  if (max > 0) fee = Math.min(fee, max);
  return Math.max(0, fee);
}

export async function createCustomerTransfer(user: UserRecord, raw: TransferRequest): Promise<TransferResult> {
  const amount = typeof raw.amount === 'number' ? raw.amount : NaN;
  const currency = sanitizeString(raw.currency, 10).toUpperCase();
  if (!currency || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 400, error: 'currency and a positive amount are required' };
  }
  if (!raw.beneficiaryId) {
    return { ok: false, status: 400, error: 'beneficiaryId is required' };
  }

  const beneficiaries = (Array.isArray(user.beneficiaries) ? user.beneficiaries : []) as Beneficiary[];
  const beneficiary = beneficiaries.find(b => b.id === raw.beneficiaryId);
  if (!beneficiary) {
    return { ok: false, status: 404, error: 'Beneficiary not found' };
  }

  const balance = Number(user.balance ?? 0);
  const primaryCurrency = (user.primaryCurrency ?? 'USD').toUpperCase();
  const config = readRatesConfig();

  // Fee rules and the account balance are both effectively USD-denominated
  // (fee flat/min/max are plain numbers with no currency tag, and balance is
  // in primaryCurrency) — normalize the client-supplied amount/currency to
  // USD before computing/comparing, otherwise a transfer requested in a
  // high-value currency could pass a check meant for the account's own
  // currency.
  const amountUsd = toUsd(amount, currency, config.rates);
  if (amountUsd === null) {
    return { ok: false, status: 400, error: `Unsupported currency: ${currency}` };
  }
  const balanceUsd = toUsd(balance, primaryCurrency, config.rates);
  if (balanceUsd === null) {
    return { ok: false, status: 500, error: 'Account currency is not supported for conversion' };
  }

  const rule = beneficiary.type === 'crypto' ? config.txFees.crypto_send : config.txFees.domestic_transfer;
  const fee = rule.enabled ? computeFee(amountUsd, rule.flat, rule.percentage, rule.minFee, rule.maxFee) : 0;
  const totalUsd = amountUsd + fee;

  if (totalUsd > balanceUsd) {
    return { ok: false, status: 400, error: 'Insufficient balance to cover the transfer and fee' };
  }

  const note = sanitizeString(raw.note, 500);
  const description = `Transfer to ${beneficiary.nickname || beneficiary.name}`;

  const transaction = await createTransaction({
    type: 'transfer',
    status: 'pending',
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    amount,
    currency: currency as never,
    description,
    note: note || undefined,
    bankName: beneficiary.bankName,
    accountNumber: beneficiary.accountNumber,
    routingNumber: beneficiary.routingNumber,
    swiftCode: beneficiary.swiftCode,
    walletAddress: beneficiary.walletAddress,
    network: beneficiary.network,
  });

  return { ok: true, transaction, fee };
}
