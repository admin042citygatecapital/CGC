/**
 * POST /api/users/swap
 * Body: { toCurrency: string }
 * Converts the account's entire balance from its current primaryCurrency
 * into toCurrency, using admin-configured exchange rates + FX markup +
 * the currency_exchange fee rule (ratesStore.ts).
 *
 * UserRecord tracks exactly one numeric `balance` + one `primaryCurrency` —
 * there's no per-asset balance ledger anywhere in this codebase (the
 * walletBtc/walletEth/etc. fields are withdrawal *destination addresses*,
 * not tracked holdings) — so "swap" here can only mean redenominating that
 * single balance, not moving value between separate crypto/fiat pots.
 * Applied immediately (unlike deposit/withdraw/transfer): this never moves
 * money off-platform, so there's no counterparty risk requiring admin
 * review — same reasoning real banks use for instant in-account FX.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, swapUserBalance } from '../../../lib/userStore.js';
import { createTransaction } from '../../../lib/transactionStore.js';
import { readRatesConfig, currencyToUsdRate, toUsd, fromUsd } from '../../../lib/ratesStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sanitizeString } from '../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const toCurrency = sanitizeString((req.body as { toCurrency?: unknown }).toCurrency, 10).toUpperCase();
  const fromCurrency = (user.primaryCurrency ?? 'USD').toUpperCase();
  if (!toCurrency) return res.status(400).json({ ok: false, error: 'toCurrency is required' });
  if (toCurrency === fromCurrency) return res.status(400).json({ ok: false, error: 'Already holding this currency' });

  const balance = Number(user.balance ?? 0);
  if (balance <= 0) return res.status(400).json({ ok: false, error: 'Balance is empty' });

  const config = readRatesConfig();
  if (currencyToUsdRate(toCurrency, config.rates) === null) {
    return res.status(400).json({ ok: false, error: 'Unsupported target currency' });
  }
  const usdValue = toUsd(balance, fromCurrency, config.rates);
  if (usdValue === null) return res.status(400).json({ ok: false, error: 'Unsupported source currency' });
  let converted = fromUsd(usdValue, toCurrency, config.rates);
  if (converted === null) return res.status(400).json({ ok: false, error: 'Unsupported target currency' });

  // FX markup — a bank-margin haircut against the customer, looked up by pair
  const pair = config.fxMarkups.pairs.find(p =>
    p.enabled && (p.pair === `${fromCurrency}/${toCurrency}` || p.pair === `${toCurrency}/${fromCurrency}`)
  );
  if (pair) converted *= (1 - pair.markup / 100);

  // currency_exchange fee, deducted in the target currency
  const rule = config.txFees.currency_exchange;
  if (rule.enabled) {
    let fee = rule.flat + converted * (rule.percentage / 100);
    if (rule.minFee > 0) fee = Math.max(fee, rule.minFee);
    if (rule.maxFee > 0) fee = Math.min(fee, rule.maxFee);
    converted = Math.max(0, converted - fee);
  }

  const result = await swapUserBalance(user.id, balance, converted, toCurrency);
  if (!result.ok) {
    if (result.conflict) {
      return res.status(409).json({ ok: false, error: 'Balance changed during the swap — please try again' });
    }
    return res.status(500).json({ ok: false, error: 'Failed to convert balance' });
  }

  const transaction = await createTransaction({
    type: 'transfer',
    status: 'completed',
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    amount: balance,
    currency: fromCurrency as never,
    description: `Currency exchange: ${balance.toFixed(2)} ${fromCurrency} → ${converted.toFixed(2)} ${toCurrency}`,
    ip: req.ip,
  });

  appendAudit({ event: 'user_currency_swap', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { from: fromCurrency, to: toCurrency, amount: balance, converted } });

  return res.json({ ok: true, balance: converted, currency: toCurrency, transaction });
}
