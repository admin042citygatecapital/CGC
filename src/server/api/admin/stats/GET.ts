import type { Request, Response } from 'express';
import { loadAllUsers } from '../../../lib/userStore.js';
import { getAuditLog } from '../../../lib/auditLog.js';
import { queryTransactions } from '../../../lib/transactionStore.js';
import { readRatesConfig } from '../../../lib/ratesStore.js';
import { queryConversations } from '../../../lib/supportStore.js';

export default async function handler(_req: Request, res: Response) {
  const now = Date.now();

  // ── Users ─────────────────────────────────────────────────────────────────
  const users = await loadAllUsers();
  const totalUsers           = users.length;
  const activeAccounts       = users.filter(u => u.status === 'active').length;
  const pendingVerifications = users.filter(u => u.kycStatus === 'submitted').length;
  const suspendedAccounts = users.filter(u => u.status === 'suspended' || u.status === 'frozen').length;

  const thirtyDaysAgo  = new Date(now - 30 * 86400000).toISOString();
  const sevenDaysAgo   = new Date(now - 7  * 86400000).toISOString();
  const prevMonthStart = new Date(now - 60 * 86400000).toISOString();
  const thisMonthStart = new Date(now).toISOString().slice(0, 7) + '-01T00:00:00.000Z';

  const newUsersMonth  = users.filter(u => u.createdAt >= thirtyDaysAgo).length;
  const newUsersWeek   = users.filter(u => u.createdAt >= sevenDaysAgo).length;
  const usersLastMonth = users.filter(u => u.createdAt >= prevMonthStart && u.createdAt < thirtyDaysAgo).length;
  const userGrowthPct  = usersLastMonth > 0
    ? +((newUsersMonth - usersLastMonth) / usersLastMonth * 100).toFixed(1)
    : 0;

  const kycApproved   = users.filter(u => u.kycStatus === 'approved').length;
  const kycSubmitted  = users.filter(u => u.kycStatus === 'submitted').length;
  const kycRejected   = users.filter(u => u.kycStatus === 'rejected').length;
  const kycNotStarted = users.filter(u => u.kycStatus === 'not_submitted').length;

  // ── Live FX rates ─────────────────────────────────────────────────────────
  const cfg = await readRatesConfig();
  const r   = cfg.rates;
  const TO_USD: Record<string, number> = {
    USD: 1,
    EUR: r.EUR_USD,
    GBP: r.GBP_USD,
    CHF: r.CHF_USD,
    CAD: r.CAD_USD,
    AUD: r.AUD_USD,
    JPY: r.JPY_USD,
    SGD: r.SGD_USD,
    AED: r.AED_USD,
    NGN: r.NGN_USD,
    BTC:  r.BTC_USD,
    ETH:  r.ETH_USD,
    SOL:  r.SOL_USD,
    USDT: r.USDT_USD,
    BNB:  r.BNB_USD,
  };

  // ── Persistent preview transaction records ────────────────────────────────
  const CREDIT_TYPES   = new Set(['deposit', 'manual_credit', 'refund', 'crypto_sell']);
  const DEBIT_TYPES    = new Set(['withdrawal', 'manual_debit', 'fee', 'transfer', 'wire_transfer', 'crypto_buy']);

  // This is the application preview register, not a sponsor or core ledger.
  const { data: allTxs } = await queryTransactions({ limit: 100_000 });
  const completedTxs = allTxs.filter(t => (t.status as string) === 'completed' || (t.status as string) === 'approved');

  // All-time totals
  let totalDepositsUsd    = 0;
  let totalWithdrawalsUsd = 0;

  for (const tx of completedTxs) {
    const rate = TO_USD[tx.currency] ?? 1;
    const usd  = Number(tx.amount ?? 0) * rate;

    if (CREDIT_TYPES.has(tx.type)) totalDepositsUsd += usd;
    if (DEBIT_TYPES.has(tx.type))  totalWithdrawalsUsd += usd;

  }

  // Monthly revenue = fees collected this calendar month
  let monthlyRevenueUsd = 0;
  for (const tx of completedTxs) {
    if (tx.type === 'fee' && tx.createdAt >= thisMonthStart) {
      monthlyRevenueUsd += Number(tx.amount ?? 0) * (TO_USD[tx.currency] ?? 1);
    }
  }

  // Previous-period deposit totals for change %
  const prevPeriodStart = new Date(now - 60 * 86400000).toISOString();
  let prevDepositsUsd = 0;
  for (const tx of completedTxs) {
    if (CREDIT_TYPES.has(tx.type) && tx.createdAt >= prevPeriodStart && tx.createdAt < thirtyDaysAgo) {
      prevDepositsUsd += Number(tx.amount ?? 0) * (TO_USD[tx.currency] ?? 1);
    }
  }
  let recentDepositsUsd = 0;
  for (const tx of completedTxs) {
    if (CREDIT_TYPES.has(tx.type) && tx.createdAt >= thirtyDaysAgo) {
      recentDepositsUsd += Number(tx.amount ?? 0) * (TO_USD[tx.currency] ?? 1);
    }
  }
  const depositGrowthPct = prevDepositsUsd > 0
    ? +((recentDepositsUsd - prevDepositsUsd) / prevDepositsUsd * 100).toFixed(1)
    : 0;

  // ── Pending / transfer KPIs ───────────────────────────────────────────────
  const pendingTxs        = allTxs.filter(t => (t.status as string) === 'pending');
  const pendingDeposits   = pendingTxs.filter(t => t.type === 'deposit').length;
  const pendingWithdrawals= pendingTxs.filter(t => t.type === 'withdrawal' || t.type === 'wire_transfer').length;
  const pendingTransfers  = pendingTxs.filter(t => t.type === 'transfer').length;

  const allTransfers      = allTxs.filter(t => t.type === 'transfer' || t.type === 'wire_transfer');
  const totalTransfersUsd = allTransfers
    .filter(t => (t.status as string) === 'completed' || (t.status as string) === 'approved')
    .reduce((s, t) => s + Number(t.amount ?? 0) * (TO_USD[t.currency] ?? 1), 0);

  // Total revenue = all fees ever collected (not just this month)
  const totalRevenueUsd = completedTxs
    .filter(t => t.type === 'fee')
    .reduce((s, t) => s + Number(t.amount ?? 0) * (TO_USD[t.currency] ?? 1), 0);

  // ── Open support tickets ──────────────────────────────────────────────────
  const { total: openTickets } = await queryConversations({ status: 'open', limit: 1 });
  const { total: resolvedThisMonth } = await queryConversations({ status: 'resolved', dateRange: '30d', limit: 1 });
  const ticketChange = resolvedThisMonth > 0 ? -(resolvedThisMonth) : 0;

  // ── Daily activity (last 30 days) — fee records and activity counts ───────
  const dailyRevenue = Array.from({ length: 30 }, (_, i) => {
    const date     = new Date(now - (29 - i) * 86400000).toISOString().slice(0, 10);
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd   = `${date}T23:59:59.999Z`;
    const dayUsers = users.filter(u => u.createdAt >= dayStart && u.createdAt <= dayEnd).length;
    const dayTxs   = completedTxs.filter(t => t.createdAt >= dayStart && t.createdAt <= dayEnd);
    const dayRevenue = dayTxs
      .filter(t => t.type === 'fee')
      .reduce((s, t) => s + Number(t.amount ?? 0) * (TO_USD[t.currency] ?? 1), 0);
    return {
      date,
      revenue:      Math.round(dayRevenue),
      transactions: dayTxs.length,
      newUsers:     dayUsers,
    };
  });

  // ── Recent activity — real transactions (newest 20) ───────────────────────
  const auditEvents = await getAuditLog({ limit: 20 });
  const auditActivity = auditEvents.map((e, i) => ({
    id:       `act_${i}`,
    type:     e.action,
    user:     e.adminEmail ?? e.adminId ?? 'System',
    amount:   null as number | null,
    currency: null as string | null,
    ts:       e.ts,
    status:   e.action.includes('failed') || e.action.includes('blocked') ? 'flagged' : 'completed',
    ip:       e.ip,
  }));

  // Supplement with real transactions if audit log is sparse
  const recentTxActivity = allTxs.slice(0, 20).map(t => ({
    id:       t.id,
    type:     t.type,
    user:     t.userName ?? t.userEmail ?? '—',
    amount:   Number(t.amount ?? 0),
    currency: t.currency,
    ts:       t.createdAt,
    status:   t.status,
    ip:       t.ip ?? '',
  }));

  const recentActivity = auditActivity.length >= 5
    ? auditActivity
    : recentTxActivity;

  return res.json({
    kpis: {
      totalUsers:           { value: totalUsers,                        change: userGrowthPct,   trend: userGrowthPct >= 0 ? 'up' : 'down' },
      activeAccounts:       { value: activeAccounts,                    change: 0,               trend: 'neutral' },
      pendingVerifications: { value: pendingVerifications,              change: pendingVerifications > 0 ? pendingVerifications : 0, trend: pendingVerifications > 0 ? 'up' : 'neutral' },
      suspendedAccounts:    { value: suspendedAccounts,                 change: 0,               trend: 'neutral' },
      newUsersThisMonth:    { value: newUsersMonth,                     change: userGrowthPct,   trend: userGrowthPct >= 0 ? 'up' : 'down' },
      newUsersThisWeek:     { value: newUsersWeek,                      change: 0,               trend: 'neutral' },
      kycApproved:          { value: kycApproved,                       change: 0,               trend: 'neutral' },
      kycPending:           { value: kycSubmitted,                      change: 0,               trend: 'neutral' },
      totalDeposits:        { value: Math.round(totalDepositsUsd),      change: depositGrowthPct, trend: depositGrowthPct >= 0 ? 'up' : 'down' },
      totalWithdrawals:     { value: Math.round(totalWithdrawalsUsd),   change: 0,               trend: 'neutral' },
      totalTransfers:       { value: Math.round(totalTransfersUsd),     change: 0,               trend: 'neutral' },
      pendingDeposits:      { value: pendingDeposits,                   change: 0,               trend: 'neutral' },
      pendingWithdrawals:   { value: pendingWithdrawals,                change: 0,               trend: 'neutral' },
      pendingTransfers:     { value: pendingTransfers,                  change: 0,               trend: 'neutral' },
      totalRevenue:         { value: Math.round(totalRevenueUsd),       change: 0,               trend: 'neutral' },
      monthlyRevenue:       { value: Math.round(monthlyRevenueUsd),     change: 0,               trend: 'neutral' },
      openTickets:          { value: openTickets,                       change: ticketChange,    trend: ticketChange < 0 ? 'down' : 'neutral' },
    },
    userBreakdown: {
      total:     totalUsers,
      active:    activeAccounts,
      pending:   pendingVerifications,
      suspended: suspendedAccounts,
      kyc: { approved: kycApproved, submitted: kycSubmitted, rejected: kycRejected, notStarted: kycNotStarted },
    },
    dailyRevenue,
    recentActivity,
    exchangeRates: cfg.rates,
    dataClassification: 'synthetic_preview',
    authoritativeSource: 'application_stores',
  });
}
