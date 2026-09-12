/**
 * GET /api/kyc/status?applicationId=... — the owner's KYC case status,
 * documents and event trail. Provider results are reported verbatim (never
 * fabricated); no document bytes or storage paths are exposed.
 */
import type { Request, Response } from 'express';
import { getApplication } from '../../../lib/applicationsStore.js';
import { getCaseByApplication, listCaseDocuments, listCaseEvents } from '../../../lib/kycCaseStore.js';
import { isDatabaseConfigured } from '../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = (req as { customerUser?: { id: string } }).customerUser;
  if (!session?.id) { res.status(401).json({ error: 'Sign in to view KYC status.' }); return; }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'KYC is unavailable while the database is offline.' });
    return;
  }
  const applicationId = (req.query.applicationId as string | undefined) ?? '';
  const app = await getApplication(applicationId);
  if (!app || app.userId !== session.id) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }
  const kycCase = await getCaseByApplication(applicationId);
  if (!kycCase) {
    res.json({ ok: true, kyc: null, message: 'KYC review starts once the application is submitted.' });
    return;
  }
  const [documents, events] = await Promise.all([listCaseDocuments(kycCase.id), listCaseEvents(kycCase.id)]);
  res.json({
    ok: true,
    kyc: {
      id: kycCase.id,
      status: kycCase.status,
      riskLevel: kycCase.riskLevel,
      provider: kycCase.providerName ? { name: kycCase.providerName, status: kycCase.providerStatus } : null,
      reviewReason: kycCase.reviewReason,
      submittedAt: kycCase.submittedAt,
      reviewedAt: kycCase.reviewedAt,
    },
    documents: documents.map(d => ({ id: d.id, documentType: d.documentType, issuingCountry: d.issuingCountry, originalName: d.originalName, createdAt: d.createdAt })),
    events: events.map(e => ({ event: e.event, at: e.createdAt, actor: e.actorRole ? `${e.actor} (${e.actorRole})` : e.actor })),
  });
}