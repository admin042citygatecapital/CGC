/**
 * GET /api/admin/kyc-cases/:id — single KYC case detail for the review panel:
 * case, linked application summary, document metadata (never storage paths)
 * and the case event trail. RBAC via central middleware (compliance.view).
 */
import type { Request, Response } from 'express';
import { getCaseWithApplication, listCaseDocuments, listCaseEvents } from '../../../../lib/kycCaseStore.js';
import { isDatabaseConfigured } from '../../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id?: string };
  if (!id) { res.status(400).json({ error: 'Case id is required.' }); return; }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'KYC is unavailable while the database is offline.' });
    return;
  }
  const detail = await getCaseWithApplication(id);
  if (!detail) { res.status(404).json({ error: 'KYC case not found.' }); return; }
  const [documents, events] = await Promise.all([listCaseDocuments(id), listCaseEvents(id)]);
  const c = detail.kycCase;
  res.status(200).json({
    ok: true,
    kycCase: {
      id: c.id, applicationId: c.applicationId, userId: c.userId, accountType: c.accountType,
      status: c.status, riskLevel: c.riskLevel, reviewerId: c.reviewerId,
      provider: c.providerName ? { name: c.providerName, status: c.providerStatus } : null,
      submittedAt: c.submittedAt, reviewedAt: c.reviewedAt, reviewReason: c.reviewReason,
    },
    application: detail.application,
    documents: documents.map(d => ({
      id: d.id, documentType: d.documentType, issuingCountry: d.issuingCountry,
      originalName: d.originalName, createdAt: d.createdAt,
    })),
    events: events.map(e => ({ event: e.event, actor: e.actor, actorRole: e.actorRole, at: e.createdAt })),
  });
}
