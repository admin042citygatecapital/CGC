/**
 * POST /api/admin/transactions/create
 * Admin creates a transaction manually for a user.
 * Supports optional backdating via createdAt field.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import {
  createTransaction, updateTransaction,
  type TxType, type TxStatus, type TxCurrency,
} from '../../../../lib/transactionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { safeParseId, sanitizeString, sanitizeNote, isOneOf } from '../../../../lib/inputValidator.js';
import { evaluateFinancialAccess } from '../../../../lib/complianceGate.js';
import { requireFinancialOperations } from '../../../../lib/platformMode.js';

const VALID_TYPES: TxType[]      = ['deposit','withdrawal','transfer','crypto_buy','crypto_sell','wire_transfer','fee','refund','manual_credit','manual_debit'];
const VALID_STATUSES: TxStatus[] = ['pending','completed','failed','rejected','flagged'];
const VALID_CURRENCIES: TxCurrency[] = ['USD','EUR','GBP','BTC','ETH','USDT','BNB','SOL','CHF','JPY','CAD','AUD','SGD','AED','NGN'];

export default async function handler(req: Request, res: Response) {
  if (!requireFinancialOperations(res)) return;
  const session = req.adminSession!;
  const {
    userId: rawUserId, type, status = 'completed', amount, currency = 'USD',
    description = '', note, createdAt,
  } = req.body ?? {};

  // Validate userId with safeParseId
  const userId = safeParseId(rawUserId);
  if (!userId)
    return res.status(400).json({ ok: false, error: 'userId is required and must be a valid ID' });

  if (!type)
    return res.status(400).json({ ok: false, error: 'type is required' });
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
    return res.status(400).json({ ok: false, error: 'amount must be a positive number' });

  // Validate enums against allowlists
  const safeType = isOneOf(type, VALID_TYPES);
  if (!safeType)
    return res.status(400).json({ ok: false, error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });

  const safeStatus = isOneOf(status, VALID_STATUSES);
  if (!safeStatus)
    return res.status(400).json({ ok: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });

  const safeCurrency = isOneOf(currency, VALID_CURRENCIES);
  if (!safeCurrency)
    return res.status(400).json({ ok: false, error: `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}` });

  // Sanitize free-text fields
  const safeDescription = sanitizeString(description, 300) || `${safeType} — admin created`;
  const safeNote        = note ? sanitizeNote(note) : undefined;

  // Validate optional backdated createdAt
  let resolvedCreatedAt: string | undefined;
  if (createdAt !== undefined && createdAt !== '') {
    const parsed = new Date(createdAt);
    if (isNaN(parsed.getTime()))
      return res.status(400).json({ ok: false, error: 'createdAt must be a valid ISO date string' });
    resolvedCreatedAt = parsed.toISOString();
  }

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  if (safeStatus === 'completed') {
    const compliance = await evaluateFinancialAccess(user);
    if (!compliance.allowed) {
      return res.status(409).json({ ok: false, error: compliance.message, code: compliance.code, compliance });
    }
  }

  const tx = await createTransaction({
    type:        safeType,
    status:      safeStatus,
    userId:      user.id,
    userName:    user.name,
    userEmail:   user.email,
    amount:      Number(amount),
    currency:    safeCurrency,
    description: safeDescription,
    note:        safeNote,
  });

  // Override createdAt if backdating was requested
  if (resolvedCreatedAt) {
    await updateTransaction(tx.id, { createdAt: resolvedCreatedAt });
    tx.createdAt = resolvedCreatedAt;
  }

  appendAudit({
    event:   'admin_transaction_create',
    adminId: session.adminId,
    userId:  user.id,
    email:   user.email,
    ip:      req.ip ?? 'unknown',
    meta: {
      txId:      tx.id,
      type:      safeType,
      amount:    Number(amount),
      currency:  safeCurrency,
      status:    safeStatus,
      backdated: !!resolvedCreatedAt,
      createdAt: tx.createdAt,
    },
  });

  return res.status(201).json({ ok: true, transaction: tx });
}
