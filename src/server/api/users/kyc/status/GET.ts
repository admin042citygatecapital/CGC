/**
 * GET /api/users/kyc/status
 * Real KYC status for the customer-facing /kyc verification page —
 * reflects the actual UserRecord fields (kycStatus/kycRejectionReason/
 * kycSubmittedAt). No fabricated "submission" object — this data model
 * only tracks flat status fields, not multi-section submissions.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid session' });

  return res.json({
    ok: true,
    kycStatus: user.kycStatus,
    rejectionReason: user.kycRejectionReason ?? '',
    submittedAt: user.kycSubmittedAt ?? null,
    hasIdDocument: !!user.idDocumentUrl,
    hasSelfie: !!user.selfieUrl,
  });
}
