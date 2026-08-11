/**
 * GET /api/users/balance
 * Returns the authenticated customer's balance broken down by currency,
 * plus the primary display currency (admin-assigned or auto-detected).
 *
 * Priority for primaryCurrency:
 *   1. user.primaryCurrency (set by admin via POST /api/admin/users/currency)
 *   2. The currency with the highest USD-equivalent balance from transactions
 *   3. 'USD' as final fallback
 *
 * Uses live rates from ratesStore (admin-controlled) instead of hardcoded values.
 */
import type { Request, Response } from 'express';
import { getTransactionsForUser } from '../../../lib/transactionStore.js';
import { readRatesConfig } from '../../../lib/ratesStore.js';

/** Build a USD-conversion map from the live ratesStore config */
function buildToUsdMap(): Record<string, number> {
  const cfg = readRatesConfig();
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

function usdTo(usd: number, currency: string, toUsdMap: Record<string, number>): number {
  const rate = toUsdMap[currency] ?? 1;
  return usd / rate;
}

const CREDIT_TYPES = new Set(['deposit', 'manual_credit', 'refund', 'crypto_sell']);
const DEBIT_TYPES  = new Set(['withdrawal', 'manual_debit', 'fee', 'transfer', 'wire_transfer', 'crypto_buy']);

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  // Load live rates once per request
  const toUsdMap = buildToUsdMap();

  // Fetch all transactions for this user
  const { transactions } = await getTransactionsForUser(user.id, { limit: 10000, offset: 0 });

  // Sum per currency — only completed/approved transactions count
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (!['completed', 'approved'].includes(tx.status)) continue;
    const cur = tx.currency ?? 'USD';
    if (totals[cur] === undefined) totals[cur] = 0;
    if (CREDIT_TYPES.has(tx.type)) {
      totals[cur] += Number(tx.amount ?? 0);
    } else if (DEBIT_TYPES.has(tx.type)) {
      totals[cur] -= Number(tx.amount ?? 0);
    }
  }

  // Build per-currency list with USD equivalents
  const currencies = Object.entries(totals)
    .map(([currency, amount]) => ({
      currency,
      amount:        Math.max(0, amount),
      usdEquivalent: Math.max(0, amount) * (toUsdMap[currency] ?? 1),
    }))
    .filter(c => c.amount > 0)
    .sort((a, b) => b.usdEquivalent - a.usdEquivalent);

  // Total portfolio value in USD.
  // When no completed transactions exist (new accounts, admin-seeded balances),
  // fall back to user.balance which is the admin-set stored balance.
  // This prevents the $0.00 display bug for accounts whose balance was set
  // directly via the admin balance-adjustment tool rather than via transactions.
  const txDerivedUsd = currencies.reduce((s, c) => s + c.usdEquivalent, 0);
  const storedBalanceUsd = user.balance ?? 0;
  const totalUsd = txDerivedUsd > 0 ? txDerivedUsd : storedBalanceUsd;

  // If we fell back to storedBalance and currencies is empty, synthesise a
  // USD entry so the dashboard portfolio bar has something to render.
  if (currencies.length === 0 && storedBalanceUsd > 0) {
    currencies.push({
      currency:      'USD',
      amount:        storedBalanceUsd,
      usdEquivalent: storedBalanceUsd,
    });
  }

  // Determine primary display currency
  const primaryCurrency =
    user.primaryCurrency ??
    currencies[0]?.currency ??
    'USD';

  // Convert total portfolio value into the primary currency
  const primaryAmount = usdTo(totalUsd, primaryCurrency, toUsdMap);

  return res.json({
    primaryCurrency,
    primaryAmount,
    totalUsd,
    currencies,
    storedBalance: user.balance ?? 0,
    currencySource: user.primaryCurrency ? 'admin' : 'auto',
  });
}
