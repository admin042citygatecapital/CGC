/**
 * GET /api/admin/kyc-cases/:id/documents/:documentId — issue a short-lived
 * signed URL for a case document held in the private KYC bucket.
 *
 * Security properties:
 *  - RBAC: reached only through the central admin middleware (compliance.view).
 *  - The raw storage path never leaves the server; only the signed URL is
 *    returned and it expires within 60 seconds.
 *  - Every issuance is recorded in the central audit log (no document bytes,
 *    no full ID numbers, no paths in the log record).
 */
import type { Request, Response } from 'express';
import { appendAuditEntry } from '../../../../../../lib/auditLog.js';
import { getCaseDocument } from '../../../../../../lib/kycCaseStore.js';
import { createKycDocumentSignedUrl } from '../../../../../../lib/kycDocumentSigning.js';
import { isDatabaseConfigured } from '../../../../../../db/db.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: Request, res: Response): Promise<void> {
  const { id, documentId } = req.params as { id?: string; documentId?: string };
  if (!id || !documentId || !UUID_RE.test(documentId)) {
    res.status(400).json({ error: 'Invalid document request.' });
    return;
  }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'KYC is unavailable while the database is offline.' });
    return;
  }
  const document = await getCaseDocument(id, documentId);
  if (!document) { res.status(404).json({ error: 'Document not found.' }); return; }
  try {
    const { signedUrl, expiresAt } = await createKycDocumentSignedUrl(document.storagePath, 60);
    const session = req.adminSession;
    await appendAuditEntry({
      adminId: session?.adminId ?? 'unknown-admin',
      adminEmail: session?.email ?? '',
      action: 'admin_kyc_case_document_viewed',
      target: 'kyc_case_document', targetId: document.id, ip: req.ip,
      details: { caseId: id, documentType: document.documentType, result: 'success' },
    });
    res.status(200).json({ ok: true, url: signedUrl, expiresAt: expiresAt.toISOString(), mimeType: document.mimeType });
  } catch (error) {
    if ((error as { code?: string }).code === 'KYC_STORAGE_UNAVAILABLE') {
      res.status(503).json({ error: 'Document storage is not configured.' });
      return;
    }
    if ((error as { code?: string }).code === 'KYC_DOCUMENT_UNAVAILABLE') {
      res.status(503).json({ error: 'Document is temporarily unavailable.' });
      return;
    }
    res.status(500).json({ error: 'Could not create a document access link.' });
  }
}
