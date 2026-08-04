/**
 * POST /api/users/withdraw
 * Body: { currency: string, amount: number, beneficiaryId?: string,
 *         destination?: { bankName, accountNumber, routingNumber?, swiftCode? }
 *                     | { asset, walletAddress, network? } }
 * Either beneficiaryId (a saved beneficiary) or an inline destination is
 * required.
 *
 * Creates a `pending` withdrawal transaction — the balance is not debited
 * here. Matches the already-existing admin/transactions/approve, which
 * performs the actual debit at approval time (and admin/transactions/reject,
 * which does nothing to the balance) — debiting immediately here would mean
 * a rejected withdrawal has no refund path back to the customer.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { createTransaction } from '../../../lib/transactionStore.js';
import { readRatesConfig, getWithdrawalUsage, toUsd } from '../../../lib/ratesStore.js';
import type { Beneficiary } from '../../../lib/beneficiaries.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sanitizeString } from '../../../lib/inputValidator.js';

function computeFee(amount: number, flat: number, pct: number): number {
  return Math.max(0, flat + amount * (pct / 100));
}

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const raw = req.body as {
    currency?: string; amount?: number; beneficiaryId?: string;
    destination?: Record<string, unknown>;
  };
  const amount = typeof raw.amount === 'number' ? raw.amount : NaN;
  const currency = sanitizeString(raw.currency, 10).toUpperCase();
  if (!currency || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'currency and a positive amount are required' });
  }

  const balance = Number(user.balance ?? 0);
  const primaryCurrency = (user.primaryCurrency ?? 'USD').toUpperCase();
  const config = readRatesConfig();

  // Fees are configured in USD (withdrawalFlatFeeUSD/withdrawalPercentageFee),
  // and the account balance is denominated in primaryCurrency, not necessarily
  // `currency` — both sides of the sufficiency check must be normalized to USD
  // before comparing, otherwise a request in a high-value currency (e.g. BTC)
  // could pass a check meant for the account's actual currency.
  const amountUsd = toUsd(amount, currency, config.rates);
  if (amountUsd === null) {
    return res.status(400).json({ ok: false, error: `Unsupported currency: ${currency}` });
  }
  const balanceUsd = toUsd(balance, primaryCurrency, config.rates);
  if (balanceUsd === null) {
    return res.status(500).json({ ok: false, error: 'Account currency is not supported for conversion' });
  }

  const fee = computeFee(amountUsd, config.fees.withdrawalFlatFeeUSD, config.fees.withdrawalPercentageFee);
  const totalUsd = amountUsd + fee;

  if (totalUsd > balanceUsd) {
    return res.status(400).json({ ok: false, error: 'Insufficient balance to cover the withdrawal and fee', fee, totalUsd, balanceUsd });
  }

  // Withdrawal limit check (best-effort — getWithdrawalUsage reads the
  // flat-file transaction log directly, so this only reflects real usage
  // when DATABASE_URL is not configured; see ratesStore.ts).
  const tier = user.accountTier ?? 'personal';
  const rule = config.limits.userOverrides[user.id]
    ?? config.limits.tierLimits.find(t => t.tier === tier)
    ?? config.limits.tierLimits.find(t => t.tier === 'default');
  if (rule) {
    const usage = getWithdrawalUsage(user.id);
    if (rule.dailyLimitUSD > 0 && usage.todayUSD + totalUsd > rule.dailyLimitUSD) {
      return res.status(400).json({ ok: false, error: `This withdrawal would exceed your daily limit of $${rule.dailyLimitUSD.toLocaleString()}` });
    }
    if (rule.monthlyLimitUSD > 0 && usage.monthUSD + totalUsd > rule.monthlyLimitUSD) {
      return res.status(400).json({ ok: false, error: `This withdrawal would exceed your monthly limit of $${rule.monthlyLimitUSD.toLocaleString()}` });
    }
  }

  // Resolve destination — a saved beneficiary or an inline one-off destination
  let destBank: { bankName?: string; accountNumber?: string; routingNumber?: string; swiftCode?: string } = {};
  let destWallet: { walletAddress?: string; network?: string } = {};

  if (raw.beneficiaryId) {
    const beneficiaries = (Array.isArray(user.beneficiaries) ? user.beneficiaries : []) as Beneficiary[];
    const b = beneficiaries.find(x => x.id === raw.beneficiaryId);
    if (!b) return res.status(404).json({ ok: false, error: 'Beneficiary not found' });
    destBank = { bankName: b.bankName, accountNumber: b.accountNumber, routingNumber: b.routingNumber, swiftCode: b.swiftCode };
    destWallet = { walletAddress: b.walletAddress, network: b.network };
  } else if (raw.destination) {
    const d = raw.destination;
    destBank = {
      bankName: sanitizeString(d.bankName, 200) || undefined,
      accountNumber: sanitizeString(d.accountNumber, 50) || undefined,
      routingNumber: sanitizeString(d.routingNumber, 50) || undefined,
      swiftCode: sanitizeString(d.swiftCode, 20) || undefined,
    };
    destWallet = {
      walletAddress: sanitizeString(d.walletAddress, 200) || undefined,
      network: sanitizeString(d.network, 50) || undefined,
    };
  } else {
    return res.status(400).json({ ok: false, error: 'beneficiaryId or destination is required' });
  }

  const isWire = !!destBank.bankName;
  const transaction = await createTransaction({
    type: isWire ? 'wire_transfer' : 'withdrawal',
    status: 'pending',
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    amount,
    currency: currency as never,
    description: isWire ? `Withdrawal to ${destBank.bankName}` : `Withdrawal to ${destWallet.walletAddress ?? 'external wallet'}`,
    bankName: destBank.bankName,
    accountNumber: destBank.accountNumber,
    routingNumber: destBank.routingNumber,
    swiftCode: destBank.swiftCode,
    walletAddress: destWallet.walletAddress,
    network: destWallet.network,
    ip: req.ip,
  });

  appendAudit({ event: 'user_withdrawal_requested', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { txId: transaction.id, amount, currency, fee } });

  return res.status(201).json({ ok: true, transaction, fee, message: 'Withdrawal request submitted — awaiting approval.' });
}
