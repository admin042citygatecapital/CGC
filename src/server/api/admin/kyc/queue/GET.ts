/**
 * GET /api/admin/kyc/queue
 * Returns enriched KYC queue with risk scores.
 *
 * Query params:
 *   status  — submitted | approved | rejected | not_submitted | expired
 *   search  — name or email
 *   sort    — newest | oldest | risk_high | risk_low
 *   page    — default 1
 *   limit   — default 15
 */
import type { Request, Response } from 'express';
import { loadAllUsers } from '../../../../lib/userStore.js';
import { buildKycQueueEntry, readKycSettings, kycIsExpired } from '../../../../lib/kycStore.js';

export default async function handler(req: Request, res: Response) {
  const status  = String(req.query.status  ?? 'submitted');
  const search  = String(req.query.search  ?? '').toLowerCase().trim();
  const sort    = String(req.query.sort    ?? 'newest');
  const page    = Math.max(1, Number(req.query.page  ?? 1));
  const limit   = Math.min(50, Number(req.query.limit ?? 15));

  const settings = await readKycSettings();
  let users = await loadAllUsers();

  // Filter by status
  if (status === 'expired') {
    users = users.filter(u => u.kycStatus === 'approved' && kycIsExpired(u, settings));
  } else {
    users = users.filter(u => u.kycStatus === status);
  }

  // Search
  if (search) {
    users = users.filter(u =>
      u.name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search)
    );
  }

  // Build enriched entries
  const entries = users.map(u => buildKycQueueEntry(u));

  // Sort
  switch (sort) {
    case 'oldest':    entries.sort((a, b) => (a.kycSubmittedAt ?? a.createdAt).localeCompare(b.kycSubmittedAt ?? b.createdAt)); break;
    case 'risk_high': entries.sort((a, b) => b.risk.score - a.risk.score); break;
    case 'risk_low':  entries.sort((a, b) => a.risk.score - b.risk.score); break;
    default:          entries.sort((a, b) => (b.kycSubmittedAt ?? b.createdAt).localeCompare(a.kycSubmittedAt ?? a.createdAt));
  }

  const total = entries.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const data  = entries.slice((page - 1) * limit, page * limit);

  return res.json({ data, total, pages, page });
}
