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
import {
  buildKycQueueEntry,
  getEffectiveKycStatus,
  isOperationalKycUser,
  readKycSettings,
  type EffectiveKycStatus,
} from '../../../../lib/kycStore.js';

const ALLOWED_STATUSES = new Set<EffectiveKycStatus>([
  'submitted', 'approved', 'rejected', 'not_submitted', 'expired',
]);
const ALLOWED_SORTS = new Set(['newest', 'oldest', 'risk_high', 'risk_low']);

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export default async function handler(req: Request, res: Response) {
  const requestedStatus = String(req.query.status ?? 'submitted') as EffectiveKycStatus;
  const status = ALLOWED_STATUSES.has(requestedStatus) ? requestedStatus : 'submitted';
  const search  = String(req.query.search  ?? '').toLowerCase().trim();
  const requestedSort = String(req.query.sort ?? 'newest');
  const sort = ALLOWED_SORTS.has(requestedSort) ? requestedSort : 'newest';
  const page = boundedInteger(req.query.page, 1, 1, 100_000);
  const limit = boundedInteger(req.query.limit, 15, 1, 50);

  const settings = await readKycSettings();
  let users = (await loadAllUsers()).filter(isOperationalKycUser);

  // Use one effective lifecycle status so expired approvals never appear in
  // both the approved and expired queues.
  users = users.filter(user => getEffectiveKycStatus(user, settings) === status);

  // Search
  if (search) {
    users = users.filter(u =>
      u.name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search)
    );
  }

  // Build enriched entries
  const entries = users.map(u => buildKycQueueEntry(u, settings));

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
