/**
 * GET /api/admin/kyc-cases — KYC case queue for the review panel.
 * RBAC: mapped under /kyc → compliance.view (central middleware).
 */
import type { Request, Response } from 'express';
import { listCasesForAdmin } from '../../../lib/kycCaseStore.js';
import { isDatabaseConfigured } from '../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'KYC is unavailable while the database is offline.' });
    return;
  }
  const { status, accountType } = req.query as { status?: string; accountType?: string };
  const rows = await listCasesForAdmin({ status: status?.toUpperCase(), accountType: accountType?.toUpperCase() });
  res.json({
    ok: true,
    cases: rows.map(c => ({
      id: c.id, applicationId: c.applicationId, userId: c.userId, accountType: c.accountType,
      status: c.status, riskLevel: c.riskLevel, reviewerId: c.reviewerId,
      provider: c.providerName ? { name: c.providerName, status: c.providerStatus } : null,
      submittedAt: c.submittedAt, reviewedAt: c.reviewedAt, reviewReason: c.reviewReason,
    })),
  });
}