/**
 * POST /api/admin/balance/adjust
 * Increase or decrease a user's balance in a specific currency.
 * Body: { userId, type: 'credit'|'debit', amount, currency, note }
 *
 * Creates a manual_credit / manual_debit transaction in the specified
 * currency so the /api/users/balance endpoint picks it up correctly.
 * Also updates the legacy `balance` field on the user record (USD-equivalent)
 * for backwards compatibility with any code that reads it directly.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { createTransaction } from '../../../../lib/transactionStore.js';
import { appendBalanceTx } from '../../../../lib/balanceStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendBalanceAdjustmentEmail } from '../../../../lib/emailService.js';
import { safeParseId, sanitizeNote, isOneOf } from '../../../../lib/inputValidator.js';
import { evaluateFinancialAccess } from '../../../../lib/complianceGate.js';

const VALID_TYPES      = ['credit','debit'] as const;
const SUPPORTED_CURRENCIES = ['USD','EUR','GBP','CHF','CAD','AUD','JPY','SGD','AED','NGN','BTC','ETH','SOL','USDT','BNB'] as const;

// Approximate USD conversion rates for the legacy balance field
const TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, CHF: 1.11, CAD: 0.74,
  AUD: 0.65, JPY: 0.0065, SGD: 0.74, AED: 0.2723, NGN: 0.00066,
  BTC: 67420, ETH: 3840, SOL: 182.5, USDT: 1, BNB: 598,
};

export default async function handler(req: Request, res: Response) {
  const { userId: rawUserId, type: rawType, amount: rawAmount, currency: rawCurrency = 'USD', note = '' } = req.body ?? {};
  const session   = req.adminSession;
  const adminId   = session?.adminId   ?? 'admin';
  const adminName = session?.email     ?? 'Admin';
  const ip        = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

  // Validate userId with safeParseId
  const userId = safeParseId(rawUserId);
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required and must be a valid ID' });
  }

  // Validate type against allowlist
  const type = isOneOf(rawType, VALID_TYPES);
  if (!type) {
    return res.status(400).json({ success: false, error: 'type must be credit or debit' });
  }

  const amount = Number(rawAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: 'amount must be a positive number' });
  }
  if (amount > 10_000_000) {
    return res.status(400).json({ success: false, error: 'amount exceeds maximum single adjustment limit' });
  }

  // Validate currency against allowlist
  const currency = isOneOf(String(rawCurrency).toUpperCase(), SUPPORTED_CURRENCIES);
  if (!currency) {
    return res.status(400).json({ success: false, error: `Unsupported currency. Must be one of: ${SUPPORTED_CURRENCIES.join(', ')}` });
  }

  // Sanitize note
  const safeNote = sanitizeNote(note);

  // Load user
  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  const compliance = await evaluateFinancialAccess(user);
  if (!compliance.allowed) {
    return res.status(409).json({ success: false, error: compliance.message, code: compliance.code, compliance });
  }
  if (safeNote.length < 10) {
    return res.status(400).json({ success: false, error: 'A balance-adjustment rationale of at least 10 characters is required.' });
  }

  // Create a transaction record in the specified currency
  await createTransaction({
    type:        type === 'credit' ? 'manual_credit' : 'manual_debit',
    status:      'completed',
    userId:      user.id,
    userName:    user.name,
    userEmail:   user.email,
    amount,
    currency:    currency as Parameters<typeof createTransaction>[0]['currency'],
    description: `Admin balance ${type}: ${safeNote}`,
  });

  // Also update the legacy `balance` field (USD-equivalent) for backwards compat
  const previousBalance = Number(user.balance ?? 0);
  const usdEquivalent   = amount * (TO_USD[currency] ?? 1);
  const newBalance      = type === 'credit'
    ? previousBalance + usdEquivalent
    : Math.max(0, previousBalance - usdEquivalent);

  await updateUser(userId, { balance: newBalance });

  // Append to balance history log
  const tx = appendBalanceTx({
    userId,
    userName:        user.name,
    userEmail:       user.email,
    type:            type === 'credit' ? 'manual_credit' : 'manual_debit',
    amount,
    previousBalance,
    newBalance,
    note:            `[${currency}] ${safeNote}`,
    adminId,
    adminName,
    ip,
  });

  // Audit log
  appendAudit({
    event:    `balance_${type}`,
    adminId,
    userId,
    ip,
    meta: {
      adminName,
      amount,
      currency,
      previousBalance,
      newBalance,
      note: safeNote,
      transactionId: tx.id,
    },
  });

  // Fire-and-forget email notification
  sendBalanceAdjustmentEmail(
    user.email, user.name, type, amount, previousBalance, newBalance,
    `[${currency}] ${safeNote}`
  ).catch(() => {});

  return res.json({
    success:         true,
    currency,
    amount,
    previousBalance,
    newBalance,
    transactionId:   tx.id,
  });
}
