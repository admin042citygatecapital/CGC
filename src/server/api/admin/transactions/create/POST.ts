/**
 * POST /api/admin/transactions/create
 * Records a controlled transaction record. Pending transfer instructions may
 * be queued for review; any state implying money movement remains provider-gated.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import {
  createTransactionIdempotent, IdempotencyConflictError, updateTransaction,
  type TxType, type TxStatus, type TxCurrency,
} from '../../../../lib/transactionStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { safeParseId, sanitizeString, sanitizeNote, isOneOf } from '../../../../lib/inputValidator.js';
import { evaluateFinancialAccess } from '../../../../lib/complianceGate.js';
import { requireFinancialOperations } from '../../../../lib/platformMode.js';
import { requireIdempotency } from '../../../../lib/idempotency.js';
import { authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';

const VALID_TYPES: TxType[]      = ['deposit','withdrawal','transfer','crypto_buy','crypto_sell','wire_transfer','fee','refund','manual_credit','manual_debit'];
const VALID_STATUSES: TxStatus[] = ['pending','completed','failed','rejected','flagged'];
const VALID_CURRENCIES: TxCurrency[] = ['USD','EUR','GBP','BTC','ETH','USDT','BNB','SOL','CHF','JPY','CAD','AUD','SGD','AED','NGN'];

export default async function handler(req: Request, res: Response) {
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
  if (!safeNote || safeNote.length < 10) {
    return res.status(400).json({ ok: false, error: 'An administration reason of at least 10 characters is required.' });
  }

  const isPendingTransferInstruction = ['transfer', 'wire_transfer'].includes(safeType) && safeStatus === 'pending';
  if (!isPendingTransferInstruction && !requireFinancialOperations(res)) return;
  if (!authorizeRecentAdminStepUp(req, res)) return;

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

  await appendCriticalAudit({
    event: 'admin_transaction_create_intent', adminId: session.adminId, userId: user.id,
    email: user.email, ip: req.ip ?? 'unknown', reason: safeNote ?? safeDescription,
    meta: { type: safeType, amount: Number(amount), currency: safeCurrency, status: safeStatus },
  });

  const idempotency = requireIdempotency(req, res, 'admin-transaction-create', {
    userId,
    type: safeType,
    status: safeStatus,
    amount: Number(amount),
    currency: safeCurrency,
    description: safeDescription,
  });
  if (!idempotency) return;

  let result;
  try {
    result = await createTransactionIdempotent({
    type:        safeType,
    status:      safeStatus,
    userId:      user.id,
    userName:    user.name,
    userEmail:   user.email,
    amount:      Number(amount),
    currency:    safeCurrency,
    description: safeDescription,
    note:        safeNote,
      idempotencyKey: idempotency.key,
      idempotencyFingerprint: idempotency.fingerprint,
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return res.status(409).json({ ok: false, error: error.message, code: 'IDEMPOTENCY_CONFLICT' });
    }
    throw error;
  }
  const tx = result.transaction;

  // Override createdAt if backdating was requested
  if (resolvedCreatedAt && !result.replayed) {
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

  return res.status(result.replayed ? 200 : 201).json({
    ok: true,
    transaction: tx,
    replayed: result.replayed,
    executionState: isPendingTransferInstruction ? 'provider_gated' : 'recorded',
  });
}
