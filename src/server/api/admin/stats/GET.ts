import type { Request, Response } from 'express';
import { loadAllUsers } from '../../../lib/userStore.js';
import { readAudit } from '../../../lib/auditLog.js';

export default async function handler(_req: Request, res: Response) {
  const now = Date.now();
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  // ── Real data from userStore ──────────────────────────────────────────────
  const users = await loadAllUsers();
  const totalUsers          = users.length;
  const activeAccounts      = users.filter(u => u.status === 'active').length;
  const pendingVerifications = users.filter(u =>
    u.status === 'pending_verification' ||
    u.status === 'pending_kyc' ||
    u.status === 'pending_approval'
  ).length;
  const suspendedAccounts   = users.filter(u => u.status === 'suspended' || u.status === 'frozen').length;

  // New users in last 30 days
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();
  const newUsersMonth = users.filter(u => u.createdAt >= thirtyDaysAgo).length;

  // New users in last 7 days
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
  const newUsersWeek = users.filter(u => u.createdAt >= sevenDaysAgo).length;

  // KYC breakdown
  const kycApproved   = users.filter(u => u.kycStatus === 'approved').length;
  const kycSubmitted  = users.filter(u => u.kycStatus === 'submitted').length;
  const kycRejected   = users.filter(u => u.kycStatus === 'rejected').length;
  const kycNotStarted = users.filter(u => u.kycStatus === 'not_submitted').length;

  // Recent audit events (last 20)
  const { data: auditEvents } = await readAudit(20, 0);
  const recentActivity = auditEvents.map((e, i) => ({
    id: `act_${i}`,
    type: e.action,
    user: e.adminEmail || (e.details?.userId as string | undefined) || 'System',
    amount: null,
    currency: null,
    ts: e.ts,
    status: e.action.includes('failed') || e.action.includes('blocked') ? 'flagged' : 'completed',
    ip: e.ip,
  }));

  // ── Daily user registrations (last 30 days) ───────────────────────────────
  const dailyRevenue = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now - (29 - i) * 86400000).toISOString().slice(0, 10);
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd   = `${date}T23:59:59.999Z`;
    const dayUsers = users.filter(u => u.createdAt >= dayStart && u.createdAt <= dayEnd).length;
    return {
      date,
      revenue:      rand(42000, 185000),   // financial data still mock until DB
      transactions: rand(120, 890),
      newUsers:     dayUsers,
    };
  });

  // ── Change calculations (vs previous period) ─────────────────────────────
  const prevMonthStart = new Date(now - 60 * 86400000).toISOString();
  const usersLastMonth = users.filter(u => u.createdAt >= prevMonthStart && u.createdAt < thirtyDaysAgo).length;
  const userGrowthPct  = usersLastMonth > 0
    ? +((newUsersMonth - usersLastMonth) / usersLastMonth * 100).toFixed(1)
    : 0;

  return res.json({ ok: true, kpis: {
      totalUsers:           { value: totalUsers,           change: userGrowthPct, trend: userGrowthPct >= 0 ? 'up' : 'down' },
      activeAccounts:       { value: activeAccounts,       change: +8.1,  trend: 'up'   },
      pendingVerifications: { value: pendingVerifications, change: pendingVerifications > 0 ? +pendingVerifications : 0, trend: pendingVerifications > 0 ? 'up' : 'neutral' },
      suspendedAccounts:    { value: suspendedAccounts,    change: 0,     trend: 'neutral' },
      newUsersThisMonth:    { value: newUsersMonth,        change: userGrowthPct, trend: userGrowthPct >= 0 ? 'up' : 'down' },
      newUsersThisWeek:     { value: newUsersWeek,         change: 0,     trend: 'neutral' },
      kycApproved:          { value: kycApproved,          change: 0,     trend: 'neutral' },
      kycPending:           { value: kycSubmitted,         change: 0,     trend: 'neutral' },
      // Financial KPIs remain mock until payment processor integration
      totalDeposits:        { value: 9_847_320, change: +22.7, trend: 'up' },
      totalWithdrawals:     { value: 4_231_890, change: +11.3, trend: 'up' },
      cryptoAUM:            { value: 3_182_440, change: +34.1, trend: 'up' },
      monthlyRevenue:       { value: 2_841_000, change: +18.9, trend: 'up' },
      openTickets:          { value: 247,       change: -14.2, trend: 'down' },
    },
    userBreakdown: {
      total:       totalUsers,
      active:      activeAccounts,
      pending:     pendingVerifications,
      suspended:   suspendedAccounts,
      kyc: { approved: kycApproved, submitted: kycSubmitted, rejected: kycRejected, notStarted: kycNotStarted },
    },
    dailyRevenue,
    cryptoBalances: [
      { symbol: 'BTC',  name: 'Bitcoin',  balance: 142.8,     usd: 9_847_320, change: +3.2 },
      { symbol: 'ETH',  name: 'Ethereum', balance: 2841.4,    usd: 7_103_500, change: +1.8 },
      { symbol: 'USDT', name: 'Tether',   balance: 4_200_000, usd: 4_200_000, change: 0   },
      { symbol: 'BNB',  name: 'BNB',      balance: 8_420,     usd: 2_526_000, change: -0.9 },
    ],
    recentActivity: recentActivity.length > 0 ? recentActivity : Array.from({ length: 8 }, (_, i) => ({
      id: `act_${i}`,
      type: ['deposit','withdrawal','kyc_approved','account_created','transfer','fraud_alert'][i % 6],
      user: ['Alice M.','Bob K.','Carol T.','David R.','Emma S.','Frank L.','Grace W.','Henry P.'][i],
      amount: rand(500, 50000),
      currency: ['USD','EUR','GBP','BTC','ETH'][i % 5],
      ts: new Date(now - i * 1800000).toISOString(),
      status: ['completed','pending','completed','completed','completed','flagged'][i % 6],
    })),
  });
}
