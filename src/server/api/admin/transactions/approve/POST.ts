/**
 * POST /api/admin/transactions/approve
 * Approve a pending transaction.
 * Body: { txId, note? }
 */
import type { Request, Response } from 'express';
import { findTransactionById, updateTransaction } from '../../../../lib/transactionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { evaluateFinancialAccess } from '../../../../lib/complianceGate.js';
import { findUserById } from '../../../../lib/userStore.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const txId = req.body?.txId ?? req.body?.transactionId;
  const note = sanitizeNote(req.body?.note ?? '');

  if (!txId) return res.status(400).json({ success: false, error: 'txId is required' });

  const tx = await findTransactionById(txId);
  if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
  if (tx.status !== 'pending') {
    return res.status(400).json({ success: false, error: `Cannot approve a transaction with status: ${tx.status}` });
  }
  if (tx.flagged) {
    return res.status(409).json({
      success: false,
      error: 'Flagged transactions cannot be approved. Resolve the compliance case first.',
      code: 'TRANSACTION_FLAGGED',
    });
  }

  const user = await findUserById(tx.userId);
  if (!user) return res.status(409).json({ success: false, error: 'The transaction customer no longer exists.' });
  const compliance = await evaluateFinancialAccess(user);
  if (!compliance.allowed) {
    appendAudit({
      event: 'transaction_approval_blocked_compliance',
      adminId: session.adminId,
      userId: tx.userId,
      email: tx.userEmail,
      ip: req.ip ?? 'unknown',
      reason: compliance.message,
      meta: { txId, code: compliance.code, kycStatus: compliance.kycStatus, amlStatus: compliance.amlStatus },
    });
    return res.status(409).json({ success: false, error: compliance.message, code: compliance.code, compliance });
  }
  if (note.length < 10) {
    return res.status(400).json({ success: false, error: 'An approval note of at least 10 characters is required.' });
  }

  const updated = await updateTransaction(txId, {
    status:     'completed',
    approvedBy: session.adminId,
    approvedAt: new Date().toISOString(),
    adminNote:  note.slice(0, 500),
  });

  appendAudit({
    event:   'transaction_approved',
    adminId: session.adminId,
    userId:  tx.userId,
    email:   tx.userEmail,
    ip:      req.ip ?? 'unknown',
    meta:    { txId, amount: tx.amount, currency: tx.currency, reference: tx.reference, note },
  });

  return res.json({ success: true, transaction: updated });
}
