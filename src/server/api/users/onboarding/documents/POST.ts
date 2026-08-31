import type { Request, Response } from 'express';
import { getOrCreateOnboardingCase } from '../../../../lib/onboardingStore.js';
import { KYC_DOCUMENT_KINDS, storeKycDocument, type KycDocumentKind } from '../../../../lib/kycPrivateStore.js';

const allowedKinds = new Set<string>(KYC_DOCUMENT_KINDS);

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser!;
  const kind = String(req.headers['x-kyc-document-kind'] ?? '') as KycDocumentKind;
  const originalName = String(req.headers['x-kyc-file-name'] ?? 'document');
  const contentType = String(req.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
  if (!allowedKinds.has(kind)) return res.status(400).json({ error: 'Invalid KYC document kind.' });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'A binary document body is required.' });
  try {
    const record = await getOrCreateOnboardingCase(user.id, user.accountTier === 'business' ? 'business' : 'individual', user.id);
    const document = await storeKycDocument({ userId: user.id, caseId: record.id, kind, contentType, originalName, bytes: req.body });
    return res.status(201).json({ ok: true, document });
  } catch (error) {
    const typed = error as Error & { code?: string };
    const status = typed.code === 'NOT_FOUND' ? 404 : typed.code === 'CASE_LOCKED' ? 409 : typed.code?.endsWith('UNAVAILABLE') || typed.code === 'KYC_BUCKET_PUBLIC' ? 503 : 400;
    return res.status(status).json({ error: typed.message, code: typed.code });
  }
}
