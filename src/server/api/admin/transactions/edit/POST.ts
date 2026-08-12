/**
 * Correct non-financial transaction metadata. Monetary and identity fields
 * remain immutable; every correction records before/after audit evidence.
 */
import type { Request, Response } from 'express';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { sanitizeNote, sanitizeString } from '../../../../lib/inputValidator.js';
import { findTransactionById, updateTransaction } from '../../../../lib/transactionStore.js';

const IMMUTABLE_FIELDS = [
  'amount', 'currency', 'type', 'status', 'userId', 'userName', 'userEmail',
  'reference', 'idempotencyKey', 'idempotencyFingerprint', 'createdAt',
  'updatedAt', 'walletAddress', 'network', 'txHash', 'bankName',
  'accountNumber', 'routingNumber', 'swiftCode', 'approvedBy', 'approvedAt',
  'rejectedBy', 'rejectedAt', 'rejectionReason', 'frozenBy', 'frozenAt',
] as const;
const ACCEPTED_FIELDS = new Set(['txId', 'description', 'adminNote', 'flagged', 'reason']);

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const body = req.body as Record<string, unknown> | undefined;
  const txId = typeof body?.txId === 'string' ? body.txId.trim() : '';
  const reason = sanitizeNote(body?.reason ?? '');

  if (!txId || !/^tx_[a-z0-9]+$/i.test(txId)) {
    return res.status(400).json({ error: 'A valid transaction ID is required.' });
  }
  if (reason.length < 10 || reason.length > 500) {
    return res.status(400).json({ error: 'A correction reason between 10 and 500 characters is required.' });
  }

  const attemptedImmutableFields = IMMUTABLE_FIELDS.filter(field => body && Object.hasOwn(body, field));
  if (attemptedImmutableFields.length) {
    return res.status(400).json({
      error: 'Financial and identity fields cannot be edited. Use a controlled reversal or adjustment entry.',
      code: 'IMMUTABLE_TRANSACTION_FIELDS',
      fields: attemptedImmutableFields,
    });
  }
  const unexpectedFields = Object.keys(body ?? {}).filter(field => !ACCEPTED_FIELDS.has(field));
  if (unexpectedFields.length) {
    return res.status(400).json({
      error: 'The request contains unsupported transaction fields.',
      code: 'UNSUPPORTED_TRANSACTION_FIELDS',
      fields: unexpectedFields,
    });
  }

  const hasDescription = Boolean(body && Object.hasOwn(body, 'description'));
  const hasAdminNote = Boolean(body && Object.hasOwn(body, 'adminNote'));
  const hasFlagged = Boolean(body && Object.hasOwn(body, 'flagged'));
  if (!hasDescription && !hasAdminNote && !hasFlagged) {
    return res.status(400).json({ error: 'Provide a description, internal note, or compliance flag change.' });
  }
  if (hasFlagged && typeof body?.flagged !== 'boolean') {
    return res.status(400).json({ error: 'flagged must be true or false.' });
  }

  const transaction = await findTransactionById(txId);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
  if (transaction.status === 'frozen' && body?.flagged === false) {
    return res.status(409).json({ error: 'A frozen transaction cannot be unflagged. Resolve the freeze through a controlled reversal or investigation.' });
  }

  const patch: { description?: string; adminNote?: string; flagged?: boolean } = {};
  if (hasDescription) {
    const description = sanitizeString(body?.description, 300);
    if (!description) return res.status(400).json({ error: 'Description cannot be empty.' });
    patch.description = description;
  }
  if (hasAdminNote) patch.adminNote = sanitizeNote(body?.adminNote ?? '').slice(0, 500);
  if (hasFlagged) patch.flagged = body?.flagged as boolean;

  await appendCriticalAudit({
    event: 'transaction_metadata_correction_intent', adminId: session.adminId,
    email: session.email, userId: transaction.userId, ip: req.ip ?? 'unknown', reason,
    meta: { txId, reference: transaction.reference, fields: Object.keys(patch) },
  });

  const updated = await updateTransaction(txId, patch);
  if (!updated) return res.status(404).json({ error: 'Transaction not found.' });

  appendAudit({
    event: 'transaction_metadata_corrected',
    adminId: session.adminId,
    email: session.email,
    userId: transaction.userId,
    ip: req.ip ?? 'unknown',
    reason,
    meta: {
      txId,
      reference: transaction.reference,
      before: {
        description: transaction.description,
        adminNote: transaction.adminNote ?? '',
        flagged: transaction.flagged,
      },
      after: {
        description: updated.description,
        adminNote: updated.adminNote ?? '',
        flagged: updated.flagged,
      },
    },
  });

  return res.json({ ok: true, transaction: updated });
}
