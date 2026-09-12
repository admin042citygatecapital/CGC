/**
 * POST /api/admin/kyc-cases/:id/decision — KYC case decision.
 * Requires reason; mirrors into the application when linked. RBAC via central
 * middleware (compliance.manage for writes under /kyc).
 */
import type { Request, Response } from 'express';
import { decideCase } from '../../../../../lib/kycCaseStore.js';
import { isDatabaseConfigured } from '../../../../../db/db.js';

const VALID = ['APPROVED', 'REJECTED', 'NEEDS_INFORMATION', 'EXPIRED', 'UNDER_REVIEW'];

export default async function handler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id?: string };
  const { decision, reason } = (req.body ?? {}) as { decision?: unknown; reason?: unknown };
  if (!id || typeof decision !== 'string' || !VALID.includes(decision)) {
    res.status(400).json({ error: `decision must be one of: ${VALID.join(', ')}` });
    return;
  }
  const reasonText = typeof reason === 'string' ? reason.trim() : '';
  if (reasonText.length < 4) {
    res.status(400).json({ error: 'A reason of at least 4 characters is required.' });
    return;
  }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'KYC is unavailable while the database is offline.' });
    return;
  }
  const row = await decideCase({
    caseId: id, decision: decision as never, reason: reasonText,
    reviewerId: req.adminSession?.adminId ?? 'unknown-admin',
    reviewerRole: req.adminSession?.role ?? '',
  });
  if (!row) { res.status(404).json({ error: 'KYC case not found.' }); return; }
  res.json({ ok: true, kycCase: { id: row.id, status: row.status, reviewedAt: row.reviewedAt } });
}