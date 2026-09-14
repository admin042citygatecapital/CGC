/**
 * POST /api/admin/kyc-cases/:id/assign — assign (or re-assign) the reviewing
 * administrator. Every change is recorded as a REVIEWER_ASSIGNED case event.
 * RBAC via central middleware (compliance.manage).
 */
import type { Request, Response } from 'express';
import { assignReviewer } from '../../../../../lib/kycCaseStore.js';
import { isDatabaseConfigured } from '../../../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id?: string };
  const { reviewerId } = (req.body ?? {}) as { reviewerId?: unknown };
  const reviewer = typeof reviewerId === 'string' ? reviewerId.trim() : '';
  if (!id) { res.status(400).json({ error: 'Case id is required.' }); return; }
  if (reviewer.length < 2 || reviewer.length > 120) {
    res.status(400).json({ error: 'A reviewerId of 2–120 characters is required.' });
    return;
  }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'KYC is unavailable while the database is offline.' });
    return;
  }
  const row = await assignReviewer({
    caseId: id, reviewerId: reviewer,
    actor: req.adminSession?.adminId ?? 'unknown-admin',
    actorRole: req.adminSession?.role ?? null,
  });
  if (!row) { res.status(404).json({ error: 'KYC case not found.' }); return; }
  res.status(200).json({ ok: true, kycCase: { id: row.id, reviewerId: row.reviewerId } });
}
