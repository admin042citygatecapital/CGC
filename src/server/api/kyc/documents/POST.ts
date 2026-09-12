/**
 * POST /api/kyc/documents — upload a KYC document for an application's case.
 *
 * Requires a customer session; the caller must own the application. Bytes are
 * sanitized and stored ONLY in the private bucket; the DB row holds metadata.
 * Liveness/selfie is a provider hook — no fabricated verification results.
 */
import type { Request, Response } from 'express';
import { getApplication } from '../../../lib/applicationsStore.js';
import { getCaseByApplication, addCaseDocument, DOCUMENT_TYPES } from '../../../lib/kycCaseStore.js';
import { isDatabaseConfigured } from '../../../db/db.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = (req as { customerUser?: { id: string; email: string } }).customerUser;
  if (!session?.id) { res.status(401).json({ error: 'Sign in to upload KYC documents.' }); return; }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'KYC is unavailable while the database is offline.' });
    return;
  }

  const { applicationId, documentType, issuingCountry } = (req.body ?? {}) as {
    applicationId?: unknown; documentType?: unknown; issuingCountry?: unknown;
  };
  const file = (req as unknown as { file?: { buffer: Buffer; mimetype?: string; originalname?: string } }).file;
  if (typeof applicationId !== 'string' || typeof documentType !== 'string') {
    res.status(400).json({ error: 'applicationId and documentType are required.' });
    return;
  }
  if (!(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
    res.status(400).json({ error: `documentType must be one of: ${DOCUMENT_TYPES.join(', ')}` });
    return;
  }
  if (!file?.buffer?.length) {
    res.status(400).json({ error: 'A document file is required (JPEG, PNG or PDF, up to 5 MB).' });
    return;
  }

  const app = await getApplication(applicationId);
  if (!app) { res.status(404).json({ error: 'Application not found.' }); return; }
  if (app.userId !== session.id) { res.status(403).json({ error: 'You do not have access to this application.' }); return; }
  const kycCase = await getCaseByApplication(applicationId);
  if (!kycCase) { res.status(409).json({ error: 'Submit the application before uploading documents.' }); return; }
  if (['APPROVED', 'REJECTED', 'EXPIRED'].includes(kycCase.status)) {
    res.status(409).json({ error: 'This case is decided; documents can no longer be added.' });
    return;
  }

  const result = await addCaseDocument({
    caseId: kycCase.id, documentType,
    issuingCountry: typeof issuingCountry === 'string' ? issuingCountry.slice(0, 60) : null,
    file: { buffer: file.buffer, contentType: file.mimetype ?? 'application/octet-stream', name: file.originalname ?? 'document' },
    uploadedBy: session.email || session.id,
  });
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.status(201).json({ ok: true, documentId: result.documentId });
}