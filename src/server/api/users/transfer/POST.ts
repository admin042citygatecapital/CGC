/**
 * POST /api/users/transfer
 * Customer initiates a transfer. Validates balance, deducts, creates transaction + notification.
 * Body: { recipient, amount, currency, note }
 *
 * Fee calculation uses the admin-controlled txFees.domestic_transfer rule (not legacy fees).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { createTransaction } from '../../../lib/transactionStore.js';
import { executeDebitOperation } from '../../../lib/financialOperationStore.js';
import { createNotification } from '../../../lib/notificationStore.js';
import { readRatesConfig } from '../../../lib/ratesStore.js';
import { sanitizeString, sanitizeNote, isOneOf } from '../../../lib/inputValidator.js';
import { requireIdempotency } from '../../../lib/idempotency.js';
import { requireFinancialOperations } from '../../../lib/platformMode.js';

const VALID_CURRENCIES = ['USD','EUR','GBP','BTC','ETH','USDT','BNB','SOL','CHF','JPY','CAD','AUD','SGD','AED','NGN'] as const;

/** Apply a FeeRule to an amount (in USD). Returns the fee amount. */
function applyFeeRule(
  amount: number,
  rule: { mode: string; flat: number; percentage: number; minFee: number; maxFee: number; enabled: boolean },
): number {
  if (!rule.enabled) return 0;
  let fee = rule.mode === 'flat' ? rule.flat : amount * (rule.percentage / 100);
  if (rule.minFee > 0) fee = Math.max(fee, rule.minFee);
  if (rule.maxFee > 0) fee = Math.min(fee, rule.maxFee);
  return Math.round(fee * 100) / 100;
}

function buildToUsdMap(cfg: ReturnType<typeof readRatesConfig>): Record<string, number> {
  const r = cfg.rates;
  return {
    USD: 1, EUR: r.EUR_USD, GBP: r.GBP_USD, CHF: r.CHF_USD,
    CAD: r.CAD_USD, AUD: r.AUD_USD, JPY: r.JPY_USD, SGD: r.SGD_USD, AED: r.AED_USD, NGN: r.NGN_USD,
    BTC: r.BTC_USD, ETH: r.ETH_USD, SOL: r.SOL_USD,
    USDT: r.USDT_USD, BNB: r.BNB_USD,
  };
}

export default async function handler(req: Request, res: Response) {
  if (!requireFinancialOperations(res)) return;
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  // KYC gate
  if (user.kycStatus !== 'approved') {
    return res.status(403).json({ error: 'Your identity verification (KYC) must be approved before you can make transfers. Please complete verification in your profile.' });
  }

  const { recipient, amount, currency = 'USD', note } = req.body ?? {};

  if (!recipient) return res.status(400).json({ error: 'Recipient is required' });
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
    return res.status(400).json({ error: 'Amount must be a positive number' });

  // Validate currency against allowlist
  const safeCurrency = isOneOf(currency, VALID_CURRENCIES);
  if (!safeCurrency) return res.status(400).json({ error: `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}` });

  // Sanitize free-text fields
  const safeRecipient = sanitizeString(recipient, 200);
  if (!safeRecipient) return res.status(400).json({ error: 'Recipient is required' });
  const safeNote = note ? sanitizeNote(note) : undefined;

  const amountNum = Number(amount);
  const idempotency = requireIdempotency(req, res, 'transfer', {
    recipient: safeRecipient, amount: amountNum, currency: safeCurrency, note: safeNote ?? '',
  });
  if (!idempotency) return;

  // ── Fee calculation: use admin-controlled txFees.domestic_transfer rule ──────
  const cfg = readRatesConfig();
  const amountUsd = amountNum * (buildToUsdMap(cfg)[safeCurrency] ?? 1);
  const rule = cfg.txFees.domestic_transfer;
  const fee  = applyFeeRule(amountUsd, rule);
  const totalDebitUsd = amountUsd + fee;

  // Create transaction
  const primaryTransaction: Parameters<typeof createTransaction>[0] = {
    type:        'transfer',
    status:      'completed',
    userId:      user.id,
    userName:    user.name,
    userEmail:   user.email,
    amount:      amountNum,
    currency:    safeCurrency as Parameters<typeof createTransaction>[0]['currency'],
    description: `Transfer to ${safeRecipient}`,
    note:        safeNote,
    idempotencyKey: idempotency.key,
    idempotencyFingerprint: idempotency.fingerprint,
    ip:          req.ip,
  };

  // Fee transaction
  const feeTransaction: Parameters<typeof createTransaction>[0] | undefined = fee > 0 ? {
      type:        'fee',
      status:      'completed',
      userId:      user.id,
      userName:    user.name,
      userEmail:   user.email,
      amount:      fee,
      currency:    'USD',
      description: `Transfer fee (${rule.mode === 'flat' ? `$${rule.flat} flat` : `${rule.percentage}%`})`,
      ip:          req.ip,
    } : undefined;

  const debit = await executeDebitOperation({
    user,
    debitUsd: totalDebitUsd,
    primary: primaryTransaction,
    fee: feeTransaction,
  });
  if (!debit.ok) {
    if (debit.reason === 'idempotency_conflict') {
      return res.status(409).json({ error: 'This Idempotency-Key was already used for a different transfer.' });
    }
    return res.status(400).json({
      error: `Insufficient balance. You need $${totalDebitUsd.toFixed(2)} (including $${fee.toFixed(2)} fee) but your balance is $${debit.balance.toFixed(2)}.`,
    });
  }

  // Notify user
  if (!debit.replayed) {
    await createNotification(
      user.id,
      'Transfer Sent',
      `Your transfer of ${amountNum.toFixed(2)} ${safeCurrency} to ${safeRecipient} has been processed. New balance: $${debit.newBalance.toFixed(2)}.`,
      '/dashboard',
    );
  }

  return res.status(debit.replayed ? 200 : 201).json({
    ok:          true,
    replayed:    debit.replayed,
    transaction: debit.transaction,
    newBalance: debit.newBalance,
    fee,
  });
}
