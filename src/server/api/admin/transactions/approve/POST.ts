/**
 * POST /api/admin/transactions/approve
 * Approve a pending transaction.
 * Body: { txId, note? }
 */
import type { Request, Response } from 'express';
import { findTransactionById, updateTransaction } from '../../../../lib/transactionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { findUserById, adjustUserBalance } from '../../../../lib/userStore.js';

const CREDIT_TYPES = ['deposit', 'refund', 'crypto_sell', 'manual_credit'];
const DEBIT_TYPES = ['withdrawal', 'transfer', 'wire_transfer', 'crypto_buy', 'fee', 'manual_debit'];

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { txId, note = '' } = req.body ?? {};

  if (!txId) return res.status(400).json({ ok: false, error: 'txId is required' });

  const tx = await findTransactionById(txId);
  if (!tx) return res.status(404).json({ ok: false, error: 'Transaction not found' });
  if (tx.status !== 'pending') {
    return res.status(400).json({ ok: false, error: `Cannot approve a transaction with status: ${tx.status}` });
  }

  // Update the user balance first (atomically, via a delta so a concurrent
  // request can't cause a lost update/overdraft) — only flip the transaction
  // to completed if the balance mutation actually succeeds.
  const txUser = await findUserById(tx.userId);
  if (!txUser) return res.status(404).json({ ok: false, error: 'Transaction owner not found' });

  if (tx.amount > 0) {
    if (CREDIT_TYPES.includes(tx.type)) {
      const result = await adjustUserBalance(tx.userId, tx.amount);
      if (!result.ok) return res.status(500).json({ ok: false, error: 'Failed to credit user balance' });
    } else if (DEBIT_TYPES.includes(tx.type)) {
      // clampToZero preserves the pre-existing "never go below $0" behavior
      // rather than rejecting the debit outright.
      const result = await adjustUserBalance(tx.userId, -tx.amount, { clampToZero: true });
      if (!result.ok) return res.status(500).json({ ok: false, error: 'Failed to debit user balance' });
    }
  }

  const updated = await updateTransaction(txId, {
    status: 'completed',
    approvedBy: session.adminId,
    approvedAt: new Date().toISOString(),
    adminNote: String(note).slice(0, 500),
  });

  appendAudit({
    event: 'transaction_approved',
    adminId: session.adminId,
    userId: tx.userId,
    email: tx.userEmail,
    ip: req.ip ?? 'unknown',
    meta: { txId, amount: tx.amount, currency: tx.currency, reference: tx.reference, note },
  });

  return res.json({ ok: true, transaction: updated });
}
