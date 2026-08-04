/**
 * POST /api/users/kyc/submit
 * Marks the customer's KYC as submitted for review, once both documents
 * (idDocumentUrl, selfieUrl — uploaded via users/kyc/upload-url/POST.ts)
 * are on file. This data model has no multi-section submission object,
 * just the flat kycStatus/kycSubmittedAt fields on UserRecord.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid session' });

  if (user.kycStatus === 'submitted') {
    return res.status(409).json({ ok: false, error: 'KYC submission already pending review' });
  }
  if (user.kycStatus === 'approved') {
    return res.status(409).json({ ok: false, error: 'KYC already approved' });
  }
  if (!user.idDocumentUrl || !user.selfieUrl) {
    return res.status(400).json({ ok: false, error: 'Please upload your ID document and selfie before submitting' });
  }

  const now = new Date().toISOString();
  await updateUser(user.id, {
    kycStatus: 'submitted',
    kycSubmittedAt: now,
    kycRejectionReason: undefined,
  } as never);

  appendAudit({ event: 'user_kyc_submitted', userId: user.id, email: user.email, ip: req.ip ?? 'unknown' });

  return res.status(201).json({ ok: true, kycStatus: 'submitted', submittedAt: now });
}
