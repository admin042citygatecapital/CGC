/**
 * GET /api/admin/kyc/queue
 * Real KYC review queue for admin/kyc-queue.tsx, built from
 * kycStore.getKycQueueRows() (derived honestly from UserRecord + security
 * flags + the KYC audit log — no fabricated submissions).
 */
import type { Request, Response } from 'express';
import { getKycQueueRows, type KycQueueStatus } from '../../../../lib/kycStore.js';

const STATUSES: KycQueueStatus[] = ['pending', 'approved', 'rejected', 'needs_info', 'flagged'];

export default async function handler(req: Request, res: Response) {
  const { status, search, sort = 'newest', page = '1', perPage = '20' } = req.query as Record<string, string>;

  let rows = await getKycQueueRows();

  if (status && (STATUSES as string[]).includes(status)) {
    rows = rows.filter(r => r.status === status);
  }
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(r =>
      r.fullName.toLowerCase().includes(s) ||
      r.email.toLowerCase().includes(s) ||
      r.userId.toLowerCase().includes(s),
    );
  }

  switch (sort) {
    case 'oldest':
      rows.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
      break;
    case 'risk_high':
      rows.sort((a, b) => b.riskScore - a.riskScore);
      break;
    case 'risk_low':
      rows.sort((a, b) => a.riskScore - b.riskScore);
      break;
    default:
      rows.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage, 10) || 20));
  const total = rows.length;
  const items = rows.slice((pageNum - 1) * perPageNum, pageNum * perPageNum);

  return res.json({ items, total });
}
