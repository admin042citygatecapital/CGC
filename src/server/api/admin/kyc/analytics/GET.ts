/**
 * GET /api/admin/kyc/analytics
 * Real KYC operations analytics for admin/kyc.tsx — computed from the actual
 * user records (kycStatus/kycSubmittedAt/kycApprovedAt/kycRejectedAt),
 * kycExpiryStore.ts (real expiry tracking), and securityStore.ts's real
 * kyc_mismatch flags (the "manual review" queue) — no fabricated numbers.
 */
import type { Request, Response } from 'express';
import { loadAllUsers } from '../../../../lib/userStore.js';
import { computeKycRiskScore } from '../../../../lib/kycStore.js';
import { getAllExpiry, getExpiringWithin } from '../../../../lib/kycExpiryStore.js';
import { queryFlags } from '../../../../lib/securityStore.js';

const DAY_MS = 86_400_000;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export default async function handler(_req: Request, res: Response) {
  const users = await loadAllUsers();
  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;

  const totalPending = users.filter(u => u.kycStatus === 'submitted').length;
  const approvedThisWeek = users.filter(
    u => u.kycStatus === 'approved' && u.kycApprovedAt && new Date(u.kycApprovedAt).getTime() >= weekAgo,
  ).length;
  const rejectedThisWeek = users.filter(
    u => u.kycStatus === 'rejected' && u.kycRejectedAt && new Date(u.kycRejectedAt).getTime() >= weekAgo,
  ).length;

  const expiryRecords = getAllExpiry();
  const totalExpired = expiryRecords.filter(r => r.status === 'expired').length;

  const reviewDurationsHours: number[] = [];
  for (const u of users) {
    if (!u.kycSubmittedAt) continue;
    const decidedAt = u.kycApprovedAt ?? u.kycRejectedAt;
    if (!decidedAt) continue;
    const hours = (new Date(decidedAt).getTime() - new Date(u.kycSubmittedAt).getTime()) / 3_600_000;
    if (hours >= 0) reviewDurationsHours.push(hours);
  }
  const avgReviewTime = reviewDurationsHours.length > 0
    ? Math.round((reviewDurationsHours.reduce((s, h) => s + h, 0) / reviewDurationsHours.length) * 10) / 10
    : 0;

  const approvedTotal = users.filter(u => u.kycStatus === 'approved').length;
  const rejectedTotal = users.filter(u => u.kycStatus === 'rejected').length;
  const decidedTotal = approvedTotal + rejectedTotal;
  const approvalRate = decidedTotal > 0 ? (approvedTotal / decidedTotal) * 100 : 0;
  const rejectionRate = decidedTotal > 0 ? (rejectedTotal / decidedTotal) * 100 : 0;

  const flaggedForReview = queryFlags({ type: 'kyc_mismatch', status: 'active' }).total;
  const manualReviewRate = users.length > 0 ? (flaggedForReview / users.length) * 100 : 0;

  const submittedUsers = users.filter(u => u.kycStatus !== 'not_submitted');
  const highRiskCount = submittedUsers.filter(u => computeKycRiskScore(u) >= 60).length;
  const expiringIn30Days = getExpiringWithin(30).length;

  const dailyVolumeMap = new Map<string, number>();
  const trendsMap = new Map<string, { approved: number; rejected: number }>();
  for (let i = 29; i >= 0; i--) {
    const key = dayKey(new Date(now - i * DAY_MS).toISOString());
    dailyVolumeMap.set(key, 0);
    trendsMap.set(key, { approved: 0, rejected: 0 });
  }
  const thirtyDaysAgo = now - 30 * DAY_MS;
  for (const u of users) {
    if (u.kycSubmittedAt && new Date(u.kycSubmittedAt).getTime() >= thirtyDaysAgo) {
      const key = dayKey(u.kycSubmittedAt);
      if (dailyVolumeMap.has(key)) dailyVolumeMap.set(key, (dailyVolumeMap.get(key) ?? 0) + 1);
    }
    if (u.kycStatus === 'approved' && u.kycApprovedAt && new Date(u.kycApprovedAt).getTime() >= thirtyDaysAgo) {
      const key = dayKey(u.kycApprovedAt);
      const t = trendsMap.get(key);
      if (t) t.approved += 1;
    }
    if (u.kycStatus === 'rejected' && u.kycRejectedAt && new Date(u.kycRejectedAt).getTime() >= thirtyDaysAgo) {
      const key = dayKey(u.kycRejectedAt);
      const t = trendsMap.get(key);
      if (t) t.rejected += 1;
    }
  }
  const dailyVolume = Array.from(dailyVolumeMap.entries()).map(([date, count]) => ({ date, count }));
  const trends = Array.from(trendsMap.entries()).map(([date, v]) => ({ date, ...v }));

  let low = 0, medium = 0, high = 0;
  for (const u of submittedUsers) {
    const score = computeKycRiskScore(u);
    if (score >= 60) high++;
    else if (score >= 30) medium++;
    else low++;
  }
  const riskDistribution = [
    { name: 'Low', value: low },
    { name: 'Medium', value: medium },
    { name: 'High', value: high },
  ];

  return res.json({
    kpis: {
      totalPending: { value: totalPending },
      approvedThisWeek: { value: approvedThisWeek },
      rejectedThisWeek: { value: rejectedThisWeek },
      totalExpired: { value: totalExpired },
      avgReviewTime: { value: avgReviewTime },
    },
    metrics: {
      approvalRate,
      rejectionRate,
      manualReviewRate,
      highRiskCount,
      expiringIn30Days,
    },
    dailyVolume,
    trends,
    riskDistribution,
  });
}
