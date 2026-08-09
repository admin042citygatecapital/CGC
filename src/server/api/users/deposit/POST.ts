/**
 * POST /api/users/deposit
 * Customer requests a deposit. Creates a pending transaction (admin approves to credit).
 * Body: { amount, currency, method, note }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { createTransactionIdempotent, IdempotencyConflictError } from '../../../lib/transactionStore.js';
import { createNotification } from '../../../lib/notificationStore.js';
import { isOneOf, sanitizeNote } from '../../../lib/inputValidator.js';
import { requireIdempotency } from '../../../lib/idempotency.js';
import { requireFinancialOperations } from '../../../lib/platformMode.js';
import { requireCustomerFinancialAccess } from '../../../lib/complianceGate.js';

const VALID_CURRENCIES = ['USD','EUR','GBP','BTC','ETH','USDT','BNB','SOL','CHF','JPY','CAD','AUD','SGD','AED','NGN'] as const;
const VALID_METHODS = ['bank_wire', 'crypto'] as const;
const MAX_DEPOSIT_REQUEST = 1_000_000_000;

export default async function handler(req: Request, res: Response) {
  if (!requireFinancialOperations(res)) return;
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  if (!await requireCustomerFinancialAccess(user, res)) return;

  const { amount, currency = 'USD', method = 'bank_wire', note } = req.body ?? {};

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > MAX_DEPOSIT_REQUEST)
    return res.status(400).json({ error: `Amount must be between 0 and ${MAX_DEPOSIT_REQUEST.toLocaleString('en-US')}` });

  const safeCurrency = isOneOf(currency, VALID_CURRENCIES);
  if (!safeCurrency) return res.status(400).json({ error: `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}` });
  const safeMethod = isOneOf(method, VALID_METHODS);
  if (!safeMethod) return res.status(400).json({ error: `Invalid deposit method. Must be one of: ${VALID_METHODS.join(', ')}` });
  const safeNote = note ? sanitizeNote(note) : undefined;
  const idempotency = requireIdempotency(req, res, 'deposit', {
    amount: amountNum,
    currency: safeCurrency,
    method: safeMethod,
    note: safeNote ?? '',
  });
  if (!idempotency) return;

  let result;
  try {
    result = await createTransactionIdempotent({
      type:        'deposit',
      status:      'pending',
      userId:      user.id,
      userName:    user.name,
      userEmail:   user.email,
      amount:      amountNum,
      currency:    safeCurrency,
      description: `Deposit via ${safeMethod === 'crypto' ? 'Crypto' : 'Bank Wire'}`,
      note:        safeNote,
      idempotencyKey: idempotency.key,
      idempotencyFingerprint: idempotency.fingerprint,
      ip:          req.ip,
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return res.status(409).json({ error: 'This Idempotency-Key was already used for a different deposit request.' });
    }
    throw error;
  }

  if (!result.replayed) await createNotification(
    user.id,
    'Deposit Request Received',
    `Your deposit request of ${amountNum.toFixed(2)} ${safeCurrency} is pending review. Funds will be credited once confirmed.`,
    '/dashboard',
  );

  return res.status(result.replayed ? 200 : 201).json({ ok: true, replayed: result.replayed, transaction: result.transaction });
}
