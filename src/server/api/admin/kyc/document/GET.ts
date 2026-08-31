import type { Request, Response } from 'express';
import { appendAuditEntry } from '../../../../lib/auditLog.js';
import { getKycDocumentForAdmin } from '../../../../lib/kycPrivateStore.js';

export default async function handler(req: Request, res: Response) {
  const documentId = String(req.query.documentId ?? '');
  if (!/^kd_[a-f0-9]{24}$/i.test(documentId)) return res.status(400).json({ error: 'Invalid document request.' });
  const document = await getKycDocumentForAdmin(documentId);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  const session = req.adminSession!;
  await appendAuditEntry({
    adminId: session.adminId, adminEmail: session.email, action: 'admin_kyc_evidence_viewed',
    target: 'kyc_document', targetId: documentId, ip: req.ip,
    details: { caseId: document.caseId, customerId: document.userId, result: 'success' },
  });
  const extension = document.metadata.mimeType === 'application/pdf' ? 'pdf' : document.metadata.mimeType === 'image/png' ? 'png' : 'jpg';
  res.set({
    'Content-Type': document.metadata.mimeType, 'Content-Length': String(document.bytes.length),
    'Cache-Control': 'private, no-store', 'Content-Disposition': `inline; filename="${document.metadata.kind}.${extension}"`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  });
  return res.send(document.bytes);
}
