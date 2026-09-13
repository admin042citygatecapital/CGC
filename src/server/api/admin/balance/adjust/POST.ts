/**
 * POST /api/admin/balance/adjust
 * Posts a controlled, balanced ledger adjustment. Stored balances are never
 * edited directly; customer balances are projections of immutable journals.
 */
import type { Request, Response } from 'express';
import { safeParseId, sanitizeNote, isOneOf } from '../../../../lib/inputValidator.js';
import { CustomerSimulationLedgerError, postCustomerControlledAdjustment } from '../../../../lib/customerSimulationLedger.js';
import { requireFinancialOperations } from '../../../../lib/platformMode.js';
import { authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';

const DIRECTIONS = ['credit', 'debit'] as const;
const REFERENCE_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{5,63}$/i;

export default async function handler(req: Request, res: Response) {
  if (!requireFinancialOperations(res)) return;
  if (!authorizeRecentAdminStepUp(req, res)) return;
  const body = req.body as Record<string, unknown>;
  const accountId = safeParseId(body.accountId);
  const direction = isOneOf(body.direction ?? body.type, DIRECTIONS);
  const amount = typeof body.amount === 'number' || typeof body.amount === 'string' ? String(body.amount) : '';
  const reason = sanitizeNote(body.reason ?? body.note ?? '');
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';

  if (!accountId) return res.status(400).json({ error: 'A valid accountId is required.', code: 'INVALID_ACCOUNT_ID' });
  if (!direction) return res.status(400).json({ error: 'direction must be credit or debit.', code: 'INVALID_DIRECTION' });
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 10_000_000) return res.status(400).json({ error: 'amount must be positive, no more than two decimals, and within the adjustment limit.', code: 'INVALID_AMOUNT' });
  if (reason.length < 10) return res.status(400).json({ error: 'A reason of at least 10 characters is required.', code: 'REASON_REQUIRED' });
  if (!REFERENCE_PATTERN.test(reference)) return res.status(400).json({ error: 'A controlled reference of 6-64 characters is required.', code: 'INVALID_REFERENCE' });
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160) return res.status(400).json({ error: 'A valid idempotencyKey is required.', code: 'IDEMPOTENCY_REQUIRED' });

  const session = req.adminSession;
  if (!session) return res.status(401).json({ error: 'Administrator authentication required.', code: 'ADMIN_AUTH_REQUIRED' });
  try {
    const adjustment = await postCustomerControlledAdjustment(
      { accountId, direction, amount, reference, reason, idempotencyKey },
      { id: session.adminId, email: session.email, ip: req.ip ?? req.socket.remoteAddress ?? 'unknown', correlationId: String(req.headers['x-request-id'] ?? req.headers['x-correlation-id'] ?? '') },
    );
    return res.status(201).json({
      success: true,
      adjustment: { id: adjustment.id, reference: adjustment.reference, status: adjustment.status, direction, currency: adjustment.currency, amount: (Number(adjustment.amountMinor) / 100).toFixed(2), journalLines: adjustment.lines.length, createdAt: adjustment.createdAt },
      balancesDerivedFromLedger: true,
    });
  } catch (error) {
    if (error instanceof CustomerSimulationLedgerError) {
      const status = error.code === 'ACCOUNT_NOT_FOUND' ? 404 : error.code === 'INSUFFICIENT_FUNDS' ? 409 : 400;
      return res.status(status).json({ error: error.message, code: error.code });
    }
    throw error;
  }
}
