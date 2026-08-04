/**
 * GET /api/admin/kyc/queue/export
 * CSV export of the real KYC queue (same rows/filters as
 * admin/kyc/queue/GET.ts), for the "Export CSV" button on kyc-queue.tsx.
 */
import type { Request, Response } from 'express';
import { getKycQueueRows, type KycQueueStatus } from '../../../../../lib/kycStore.js';

const STATUSES: KycQueueStatus[] = ['pending', 'approved', 'rejected', 'needs_info', 'flagged'];

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default async function handler(req: Request, res: Response) {
  const { status, search, sort = 'newest' } = req.query as Record<string, string>;

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

  const header = ['User ID', 'Full Name', 'Email', 'Submitted At', 'Document Type', 'Country', 'Risk Score', 'Status', 'Assigned Reviewer'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.userId, r.fullName, r.email, r.submittedAt, r.documentType, r.countryName,
      String(r.riskScore), r.status, r.assignedReviewer ?? '',
    ].map(csvCell).join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="kyc-queue-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(lines.join('\n'));
}
