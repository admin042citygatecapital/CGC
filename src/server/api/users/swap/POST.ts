/**
 * POST /api/users/swap
 * Executes a currency/crypto swap for the authenticated customer.
 * Body: { fromAsset, toAsset, amount }
 *
 * Uses live rates from ratesStore (admin-controlled).
 * Applies:
 *   1. Per-pair FX markup (fxMarkups) — added to the effective rate shown to customer
 *   2. currency_exchange fee rule (txFees.currency_exchange) — deducted from user balance
 * Records: debit of fromAsset, credit of toAsset, fee transaction.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { createTransaction } from '../../../lib/transactionStore.js';
import { executeSwapOperation } from '../../../lib/financialOperationStore.js';
import { readRatesConfig } from '../../../lib/ratesStore.js';
import { isOneOf } from '../../../lib/inputValidator.js';
import { requireIdempotency } from '../../../lib/idempotency.js';
import { requireFinancialOperations } from '../../../lib/platformMode.js';
import { requireCustomerFinancialAccess } from '../../../lib/complianceGate.js';

// Explicit asset allowlist — prevents arbitrary string injection into transaction records
const SUPPORTED_ASSETS = ['USD','EUR','GBP','CHF','CAD','AUD','JPY','SGD','AED','NGN','BTC','ETH','SOL','USDT','BNB'] as const;

/** Build a "1 unit = N USD" map from live ratesStore */
function buildToUsdMap(cfg: ReturnType<typeof readRatesConfig>): Record<string, number> {
  const r = cfg.rates;
  return {
    USD:  1,
    EUR:  r.EUR_USD,
    GBP:  r.GBP_USD,
    CHF:  r.CHF_USD,
    CAD:  r.CAD_USD,
    AUD:  r.AUD_USD,
    JPY:  r.JPY_USD,
    SGD:  r.SGD_USD,
    AED:  r.AED_USD,
    NGN:  r.NGN_USD,
    BTC:  r.BTC_USD,
    ETH:  r.ETH_USD,
    SOL:  r.SOL_USD,
    USDT: r.USDT_USD,
    BNB:  r.BNB_USD,
  };
}

/**
 * Look up the FX markup % for a given pair (e.g. "BTC/USD").
 * Tries both directions: "BTC/USD" and "USD/BTC".
 * Returns 0 if the pair is not found or is disabled.
 */
function getFxMarkupPct(
  cfg: ReturnType<typeof readRatesConfig>,
  fromAsset: string,
  toAsset: string,
): number {
  const pairs = cfg.fxMarkups?.pairs ?? [];
  const direct  = pairs.find(p => p.pair === `${fromAsset}/${toAsset}`);
  const reverse = pairs.find(p => p.pair === `${toAsset}/${fromAsset}`);
  const match   = direct ?? reverse;
  if (!match || !match.enabled) return 0;
  return match.markup;
}

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

export default async function handler(req: Request, res: Response) {
  if (!requireFinancialOperations(res)) return;
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  if (!await requireCustomerFinancialAccess(user, res)) return;

  const { fromAsset, toAsset, amount } = req.body as {
    fromAsset?: string;
    toAsset?:   string;
    amount?:    string | number;
  };

  if (!fromAsset || !toAsset) {
    return res.status(400).json({ error: 'fromAsset and toAsset are required' });
  }

  // Validate both assets against the explicit allowlist
  const safeFrom = isOneOf(fromAsset, SUPPORTED_ASSETS);
  const safeTo   = isOneOf(toAsset,   SUPPORTED_ASSETS);
  if (!safeFrom) return res.status(400).json({ error: `Unsupported asset: ${String(fromAsset).slice(0, 20)}` });
  if (!safeTo)   return res.status(400).json({ error: `Unsupported asset: ${String(toAsset).slice(0, 20)}` });
  if (safeFrom === safeTo) {
    return res.status(400).json({ error: 'Cannot swap an asset for itself' });
  }

  const fromAmount = parseFloat(String(amount ?? '0'));
  if (!Number.isFinite(fromAmount) || fromAmount <= 0 || fromAmount > 1_000_000_000) {
    return res.status(400).json({ error: 'Amount must be greater than 0' });
  }

  const idempotency = requireIdempotency(req, res, 'swap', {
    fromAsset: safeFrom,
    toAsset: safeTo,
    amount: fromAmount,
  });
  if (!idempotency) return;

  // Load live config
  const cfg      = readRatesConfig();
  const toUsdMap = buildToUsdMap(cfg);

  // ── FX markup ─────────────────────────────────────────────────────────────
  const markupPct = getFxMarkupPct(cfg, safeFrom, safeTo);

  // Convert via USD bridge, then apply markup spread
  const usdValueRaw  = fromAmount * (toUsdMap[safeFrom] ?? 1);
  const usdValueNet  = usdValueRaw * (1 - markupPct / 100);
  const toAmountRaw  = usdValueNet / (toUsdMap[safeTo] ?? 1);

  // ── Exchange fee ──────────────────────────────────────────────────────────
  const feeRule    = cfg.txFees.currency_exchange;
  const feeInFrom  = applyFeeRule(fromAmount, feeRule);
  const feeInUsd   = feeInFrom * (toUsdMap[safeFrom] ?? 1);

  const totalDebit = fromAmount + feeInFrom;

  const debitTransaction: Parameters<typeof createTransaction>[0] = {
    type:        'withdrawal',
    status:      'completed',
    userId:      user.id,
    userName:    user.name,
    userEmail:   user.email,
    amount:      fromAmount,
    currency:    safeFrom as Parameters<typeof createTransaction>[0]['currency'],
    idempotencyKey: idempotency.key,
    idempotencyFingerprint: idempotency.fingerprint,
    description: `Swap: sold ${fromAmount} ${safeFrom} \u2192 ${safeTo}${markupPct > 0 ? ` (${markupPct}% spread)` : ''}`,
  };

  const creditTransaction: Parameters<typeof createTransaction>[0] = {
    type:        'deposit',
    status:      'completed',
    userId:      user.id,
    userName:    user.name,
    userEmail:   user.email,
    amount:      parseFloat(toAmountRaw.toFixed(8)),
    currency:    safeTo as Parameters<typeof createTransaction>[0]['currency'],
    description: `Swap: received ${toAmountRaw.toFixed(6)} ${safeTo} from ${safeFrom}`,
  };

  const feeTransaction: Parameters<typeof createTransaction>[0] | undefined = feeInFrom > 0 ? {
      type:        'fee',
      status:      'completed',
      userId:      user.id,
      userName:    user.name,
      userEmail:   user.email,
      amount:      parseFloat(feeInFrom.toFixed(8)),
      currency:    safeFrom as Parameters<typeof createTransaction>[0]['currency'],
      description: `Exchange fee (${feeRule.mode === 'flat' ? `$${feeRule.flat} flat` : `${feeRule.percentage}%`})`,
    } : undefined;

  const swap = await executeSwapOperation({
    user,
    fromAsset: safeFrom,
    toAsset: safeTo,
    fromAmount,
    toAmount: parseFloat(toAmountRaw.toFixed(8)),
    feeInFrom,
    debit: debitTransaction,
    credit: creditTransaction,
    fee: feeTransaction,
  });
  if (!swap.ok) {
    if (swap.reason === 'idempotency_conflict') {
      return res.status(409).json({ error: 'This Idempotency-Key was already used for a different swap.' });
    }
    return res.status(400).json({
      error: `Insufficient ${safeFrom} balance. You need ${totalDebit.toFixed(8)} ${safeFrom} but have ${swap.balance.toFixed(8)}.`,
    });
  }

  return res.json({
    ok:         true,
    replayed:   swap.replayed,
    fromAsset:  safeFrom,
    toAsset:    safeTo,
    fromAmount,
    toAmount:   parseFloat(toAmountRaw.toFixed(8)),
    rate:       parseFloat((toAmountRaw / fromAmount).toFixed(8)),
    fee:        feeInFrom,
    feeUsd:     parseFloat(feeInUsd.toFixed(4)),
    markupPct,
    sourceBalance: parseFloat(swap.sourceBalance.toFixed(8)),
    usdBalance: swap.usdBalance,
  });
}
