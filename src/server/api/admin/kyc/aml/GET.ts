import type { Request, Response } from 'express';
import { evaluateFinancialAccess } from '../../../../lib/complianceGate.js';
import { loadAllUsers, type AMLStatus } from '../../../../lib/userStore.js';
import { readKycSettings } from '../../../../lib/kycStore.js';

const AML_STATUSES = new Set<AMLStatus>(['not_screened', 'pending', 'cleared', 'review', 'blocked']);

export default async function handler(req: Request, res: Response) {
  const requestedStatus = String(req.query.status ?? 'all') as AMLStatus | 'all';
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));

  if (requestedStatus !== 'all' && !AML_STATUSES.has(requestedStatus)) {
    return res.status(400).json({ error: 'Invalid AML status filter.' });
  }

  const allUsers = await loadAllUsers();
  const kycSettings = await readKycSettings();
  let users = [...allUsers];
  if (requestedStatus !== 'all') users = users.filter(user => (user.amlStatus ?? 'not_screened') === requestedStatus);
  if (search) users = users.filter(user =>
    user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search),
  );

  users.sort((a, b) => {
    const aTime = a.amlReviewedAt ?? a.createdAt;
    const bTime = b.amlReviewedAt ?? b.createdAt;
    return bTime.localeCompare(aTime);
  });

  const total = users.length;
  const selected = users.slice((page - 1) * limit, page * limit);
  const data = await Promise.all(selected.map(async user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    country: user.country,
    status: user.status,
    kycStatus: user.kycStatus,
    amlStatus: user.amlStatus ?? 'not_screened',
    amlRiskLevel: user.amlRiskLevel ?? 'unrated',
    amlReviewedAt: user.amlReviewedAt,
    amlReviewedBy: user.amlReviewedBy,
    amlReviewReason: user.amlReviewReason,
    amlNextReviewAt: user.amlNextReviewAt,
    financialAccess: await evaluateFinancialAccess(user, kycSettings),
  })));

  const counts = Object.fromEntries(
    [...AML_STATUSES].map(status => [status, allUsers.filter(user => (user.amlStatus ?? 'not_screened') === status).length]),
  );

  return res.json({ data, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts });
}
