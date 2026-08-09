/**
 * POST /api/users/transfers
 * Wizard-style transfer: domestic or international wire.
 * Body: { fromCurrency, recipientName, recipientAccount, recipientBank, recipientCountry, amount, note, otp }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { createTransaction } from '../../../lib/transactionStore.js';
import { executeDebitOperation } from '../../../lib/financialOperationStore.js';
import { createNotification } from '../../../lib/notificationStore.js';
import { readRatesConfig } from '../../../lib/ratesStore.js';
import { isOneOf, sanitizeString, sanitizeNote } from '../../../lib/inputValidator.js';
import { requireIdempotency } from '../../../lib/idempotency.js';
import { requireFinancialOperations } from '../../../lib/platformMode.js';
import { requireCustomerFinancialAccess } from '../../../lib/complianceGate.js';

const VALID_CURRENCIES = ['USD','EUR','GBP','BTC','ETH','USDT','BNB','SOL','CHF','JPY','CAD','AUD','SGD','AED','NGN'] as const;
const MAX_TRANSFER = 1_000_000_000;

function buildToUsdMap(cfg: ReturnType<typeof readRatesConfig>): Record<string, number> {
  const r = cfg.rates;
  return {
    USD: 1, EUR: r.EUR_USD, GBP: r.GBP_USD, CHF: r.CHF_USD,
    CAD: r.CAD_USD, AUD: r.AUD_USD, JPY: r.JPY_USD, SGD: r.SGD_USD, AED: r.AED_USD, NGN: r.NGN_USD,
    BTC: r.BTC_USD, ETH: r.ETH_USD, SOL: r.SOL_USD,
    USDT: r.USDT_USD, BNB: r.BNB_USD,
  };
}

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

export default async function handler(req: Request, res: Response) {
  if (!requireFinancialOperations(res)) return;
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  if (!await requireCustomerFinancialAccess(user, res)) return;

  if (req.body?.type === 'internal_transfer') {
    return res.status(409).json({ error: 'Internal wallet transfers are not available until a separate trading cash account is configured.' });
  }

  const {
    fromCurrency = 'USD',
    recipientName,
    recipientAccount,
    recipientBank,
    recipientCountry,
    amount,
    note,
  } = req.body ?? {};

  if (!recipientName)    return res.status(400).json({ error: 'Recipient name is required' });
  if (!recipientAccount) return res.status(400).json({ error: 'Recipient account is required' });
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > MAX_TRANSFER)
    return res.status(400).json({ error: `Amount must be between 0 and ${MAX_TRANSFER.toLocaleString('en-US')}` });

  const safeRecipientName    = sanitizeString(String(recipientName),    200);
  const safeRecipientAccount = sanitizeString(String(recipientAccount), 100);
  const safeRecipientBank    = recipientBank    ? sanitizeString(String(recipientBank),    200) : '';
  const safeRecipientCountry = recipientCountry ? sanitizeString(String(recipientCountry), 100) : '';
  const safeNote             = note ? sanitizeNote(String(note)) : undefined;
  const safeCurrency = isOneOf(fromCurrency, VALID_CURRENCIES);
  if (!safeCurrency) {
    return res.status(400).json({ error: `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}` });
  }

  const cfg      = readRatesConfig();
  const isIntl   = safeRecipientCountry && safeRecipientCountry.toUpperCase() !== 'US';
  const feeRule  = isIntl ? cfg.txFees.international_wire : cfg.txFees.domestic_transfer;
  const amountUsd = amountNum * (buildToUsdMap(cfg)[safeCurrency] ?? 1);
  const idempotency = requireIdempotency(req, res, 'wire-transfer', {
    recipientName: safeRecipientName,
    recipientAccount: safeRecipientAccount,
    recipientBank: safeRecipientBank,
    recipientCountry: safeRecipientCountry,
    amount: amountNum,
    currency: safeCurrency,
    note: safeNote ?? '',
  });
  if (!idempotency) return;
  const fee      = applyFeeRule(amountUsd, feeRule);
  const totalDebitUsd = amountUsd + fee;
  const description = `Wire to ${safeRecipientName}${safeRecipientBank ? ` via ${safeRecipientBank}` : ''}`;

  const primaryTransaction: Parameters<typeof createTransaction>[0] = {
    type:        'transfer',
    status:      'completed',
    userId:      user.id,
    userName:    user.name,
    userEmail:   user.email,
    amount:      amountNum,
    currency:    safeCurrency,
    description,
    note:        safeNote,
    accountNumber: safeRecipientAccount,
    bankName:    safeRecipientBank || undefined,
    idempotencyKey: idempotency.key,
    idempotencyFingerprint: idempotency.fingerprint,
    ip:          req.ip,
  };

  const feeTransaction: Parameters<typeof createTransaction>[0] | undefined = fee > 0 ? {
      type:        'fee',
      status:      'completed',
      userId:      user.id,
      userName:    user.name,
      userEmail:   user.email,
      amount:      fee,
      currency:    'USD',
      description: `Transfer fee`,
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
      return res.status(409).json({ error: 'This Idempotency-Key was already used for a different wire transfer.' });
    }
    return res.status(400).json({
      error: `Insufficient balance. You need $${totalDebitUsd.toFixed(2)} (including $${fee.toFixed(2)} fee) but your balance is $${debit.balance.toFixed(2)}.`,
    });
  }

  if (!debit.replayed) {
    await createNotification(
      user.id,
      'Transfer Sent',
      `Your transfer of ${amountNum.toFixed(2)} ${safeCurrency} to ${safeRecipientName} has been processed. Reference: ${debit.transaction.reference}. New balance: $${debit.newBalance.toFixed(2)}.`,
      '/dashboard/transfers',
    );
  }

  return res.status(debit.replayed ? 200 : 201).json({
    ok:          true,
    replayed:    debit.replayed,
    reference: debit.transaction.reference,
    transaction: debit.transaction,
    newBalance: debit.newBalance,
    fee,
  });
}
