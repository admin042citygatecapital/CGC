/**
 * POST /api/users/withdraw
 * Customer requests a withdrawal. Validates balance, enforces withdrawal limits,
 * creates pending transaction.
 * Body: { amount, currency, destination, destinationType, note }
 *
 * Fee uses admin-controlled txFees.international_wire rule (not legacy fees.withdrawalFlatFeeUSD).
 * Limits enforced from admin-controlled limits store (tier defaults + per-user overrides).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { createTransaction } from '../../../lib/transactionStore.js';
import { executeDebitOperation } from '../../../lib/financialOperationStore.js';
import { createNotification } from '../../../lib/notificationStore.js';
import { readRatesConfig, getWithdrawalUsage } from '../../../lib/ratesStore.js';
import { sanitizeString, sanitizeNote, isOneOf } from '../../../lib/inputValidator.js';
import { requireIdempotency } from '../../../lib/idempotency.js';
import { requireFinancialOperations } from '../../../lib/platformMode.js';
import { requireCustomerFinancialAccess } from '../../../lib/complianceGate.js';

const VALID_CURRENCIES     = ['USD','EUR','GBP','BTC','ETH','USDT','BNB','SOL','CHF','JPY','CAD','AUD','SGD','AED','NGN'] as const;
const VALID_DEST_TYPES     = ['bank','crypto'] as const;

/** Apply a FeeRule to an amount. Returns the fee amount. */
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

/** Build a "1 unit = N USD" map from live rates. */
function buildToUsdMap(cfg: ReturnType<typeof readRatesConfig>): Record<string, number> {
  const r = cfg.rates;
  return {
    USD: 1,
    EUR: r.EUR_USD,
    GBP: r.GBP_USD,
    CHF: r.CHF_USD,
    CAD: r.CAD_USD,
    AUD: r.AUD_USD,
    JPY: r.JPY_USD,
    SGD: r.SGD_USD,
    AED: r.AED_USD,
    NGN: r.NGN_USD,
    BTC:  r.BTC_USD,
    ETH:  r.ETH_USD,
    SOL:  r.SOL_USD,
    USDT: r.USDT_USD,
    BNB:  r.BNB_USD,
  };
}

export default async function handler(req: Request, res: Response) {
  if (!requireFinancialOperations(res)) return;
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  if (!await requireCustomerFinancialAccess(user, res)) return;

  const { amount, currency = 'USD', destination, destinationType = 'bank', note } = req.body ?? {};

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
    return res.status(400).json({ error: 'Amount must be a positive number' });
  if (!destination)
    return res.status(400).json({ error: 'Destination is required' });

  // Validate currency and destinationType against allowlists
  const safeCurrency = isOneOf(currency, VALID_CURRENCIES);
  if (!safeCurrency) return res.status(400).json({ error: `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}` });

  const safeDestType = isOneOf(destinationType, VALID_DEST_TYPES);
  if (!safeDestType) return res.status(400).json({ error: 'destinationType must be bank or crypto' });

  // Sanitize free-text fields
  const safeDestination = sanitizeString(destination, 200);
  if (!safeDestination) return res.status(400).json({ error: 'Destination is required' });
  const safeNote = note ? sanitizeNote(note) : undefined;

  const amountNum = Number(amount);
  const idempotency = requireIdempotency(req, res, 'withdrawal', {
    amount: amountNum,
    currency: safeCurrency,
    destination: safeDestination,
    destinationType: safeDestType,
    note: safeNote ?? '',
  });
  if (!idempotency) return;

  const cfg     = readRatesConfig();
  const toUsd   = buildToUsdMap(cfg);
  const amountUsd = amountNum * (toUsd[safeCurrency] ?? 1);

  // ── Withdrawal limit enforcement ──────────────────────────────────────────
  const userTier = user.accountTier ?? 'personal';
  const limits   = cfg.limits;

  // Resolve effective limits: per-user override takes precedence over tier default
  const override = limits.userOverrides[user.id];
  let dailyLimitUSD   = 0;
  let monthlyLimitUSD = 0;

  if (override) {
    dailyLimitUSD   = override.dailyLimitUSD;
    monthlyLimitUSD = override.monthlyLimitUSD;
  } else {
    const tierRule = limits.tierLimits.find(t => t.tier === userTier)
                  ?? limits.tierLimits.find(t => t.tier === 'default');
    if (tierRule) {
      dailyLimitUSD   = tierRule.dailyLimitUSD;
      monthlyLimitUSD = tierRule.monthlyLimitUSD;
    }
  }

  // Check current usage
  const usage = await getWithdrawalUsage(user.id);

  if (dailyLimitUSD > 0 && (usage.todayUSD + amountUsd) > dailyLimitUSD) {
    const remaining = Math.max(0, dailyLimitUSD - usage.todayUSD);
    return res.status(400).json({
      error: `Daily withdrawal limit exceeded. You have $${remaining.toFixed(2)} remaining today (limit: $${dailyLimitUSD.toLocaleString()}).`,
    });
  }

  if (monthlyLimitUSD > 0 && (usage.monthUSD + amountUsd) > monthlyLimitUSD) {
    const remaining = Math.max(0, monthlyLimitUSD - usage.monthUSD);
    return res.status(400).json({
      error: `Monthly withdrawal limit exceeded. You have $${remaining.toFixed(2)} remaining this month (limit: $${monthlyLimitUSD.toLocaleString()}).`,
    });
  }

  // ── Fee calculation: use admin-controlled txFees.international_wire rule ──
  const rule = cfg.txFees.international_wire;
  const fee  = applyFeeRule(amountUsd, rule);
  const totalDebitUsd = amountUsd + fee;

  const primaryTransaction: Parameters<typeof createTransaction>[0] = {
    type:        'withdrawal',
    status:      'pending',
    userId:      user.id,
    userName:    user.name,
    userEmail:   user.email,
    amount:      amountNum,
    currency:    safeCurrency as Parameters<typeof createTransaction>[0]['currency'],
    description: `Withdrawal to ${safeDestType === 'crypto' ? 'crypto wallet' : 'bank account'}`,
    note:        safeNote,
    walletAddress: safeDestType === 'crypto' ? safeDestination : undefined,
    accountNumber: safeDestType === 'bank'   ? safeDestination : undefined,
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
      description: `Withdrawal fee (${rule.mode === 'flat' ? `$${rule.flat} flat` : `${rule.percentage}%`})`,
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
      return res.status(409).json({ error: 'This Idempotency-Key was already used for a different withdrawal.' });
    }
    return res.status(400).json({
      error: `Insufficient balance. You need $${totalDebitUsd.toFixed(2)} (including $${fee.toFixed(2)} fee) but your balance is $${debit.balance.toFixed(2)}.`,
    });
  }

  if (!debit.replayed) await createNotification(
    user.id,
    'Withdrawal Request Submitted',
    `Your withdrawal of ${amountNum.toFixed(2)} ${safeCurrency} is pending processing. Estimated arrival: 1–3 business days.`,
    '/dashboard',
  );

  return res.status(debit.replayed ? 200 : 201).json({ ok: true, replayed: debit.replayed, transaction: debit.transaction, newBalance: debit.newBalance, fee });
}
