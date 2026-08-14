/**
 * reportsStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified data engine for all 11 report types:
 *   customers · transactions · revenue · deposits · withdrawals
 *   exchange · kyc · aml · support · emails · security
 *
 * All functions accept a ReportQuery (period + optional filters) and return
 * a typed ReportResult that the API handler serialises directly to JSON.
 *
 * Design notes:
 *  - Full ledger scans are acceptable for flat-file JSONL at this scale.
 *  - All monetary values are normalised to USD using live rates from ratesStore.
 *  - "period" is one of: 7d | 30d | 90d | ytd | all
 */

import fs   from 'node:fs';
import { loadAllUsers }        from './userStore.js';
import { queryTransactions }   from './transactionStore.js';
import { readRatesConfig }     from './ratesStore.js';
import { listSupportConversationsForReport } from './supportDatabaseStore.js';
import { loadAlerts }          from './securityCenterStore.js';
import { privateSubdirectory } from './storagePaths.js';

// ─── Shared helpers ───────────────────────────────────────────────────────────

export type Period = '7d' | '30d' | '90d' | 'ytd' | 'all';

export interface ReportQuery {
  period:   Period;
  currency?: string;   // filter by currency (transactions / deposits / withdrawals)
  type?:    string;    // filter by tx type
  status?:  string;    // filter by status
}

function periodStart(period: Period): string {
  const now = Date.now();
  if (period === '7d')  return new Date(now - 7  * 86_400_000).toISOString();
  if (period === '30d') return new Date(now - 30 * 86_400_000).toISOString();
  if (period === '90d') return new Date(now - 90 * 86_400_000).toISOString();
  if (period === 'ytd') return new Date(new Date().getFullYear(), 0, 1).toISOString();
  return '1970-01-01T00:00:00.000Z';
}

function prevPeriodStart(period: Period): string {
  const now = Date.now();
  if (period === '7d')  return new Date(now - 14 * 86_400_000).toISOString();
  if (period === '30d') return new Date(now - 60 * 86_400_000).toISOString();
  if (period === '90d') return new Date(now - 180 * 86_400_000).toISOString();
  if (period === 'ytd') return new Date(new Date().getFullYear() - 1, 0, 1).toISOString();
  return '1970-01-01T00:00:00.000Z';
}

function toUsdRate(): Record<string, number> {
  const cfg = readRatesConfig();
  const r   = cfg.rates;
  return {
    USD: 1, EUR: r.EUR_USD, GBP: r.GBP_USD, CHF: r.CHF_USD,
    CAD: r.CAD_USD, AUD: r.AUD_USD, JPY: r.JPY_USD, SGD: r.SGD_USD, AED: r.AED_USD, NGN: r.NGN_USD,
    BTC: r.BTC_USD, ETH: r.ETH_USD, SOL: r.SOL_USD, USDT: r.USDT_USD, BNB: r.BNB_USD,
  };
}

/** Build a daily-bucket map for the period (YYYY-MM-DD → 0) */
function buildDailyBuckets(start: string, end: string = new Date().toISOString()): Record<string, number> {
  const buckets: Record<string, number> = {};
  const s = new Date(start); s.setUTCHours(0, 0, 0, 0);
  const e = new Date(end);   e.setUTCHours(0, 0, 0, 0);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  return buckets;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return +((current - previous) / previous * 100).toFixed(1);
}

// ─── 1. CUSTOMERS REPORT ─────────────────────────────────────────────────────

export async function customersReport(q: ReportQuery) {
  const users  = await loadAllUsers();
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);

  const inPeriod = users.filter(u => u.createdAt >= start);
  const inPrev   = users.filter(u => u.createdAt >= pStart && u.createdAt < start);

  // Status breakdown
  const byStatus: Record<string, number> = {};
  for (const u of users) byStatus[u.status] = (byStatus[u.status] ?? 0) + 1;

  // KYC breakdown
  const byKyc: Record<string, number> = {};
  for (const u of users) byKyc[u.kycStatus ?? 'not_submitted'] = (byKyc[u.kycStatus ?? 'not_submitted'] ?? 0) + 1;

  // Tier breakdown
  const byTier: Record<string, number> = {};
  for (const u of users) byTier[u.accountTier ?? 'personal'] = (byTier[u.accountTier ?? 'personal'] ?? 0) + 1;

  // Daily registrations
  const dailyBuckets = buildDailyBuckets(start);
  for (const u of inPeriod) {
    const day = u.createdAt.slice(0, 10);
    if (day in dailyBuckets) dailyBuckets[day]++;
  }
  const dailyRegistrations = Object.entries(dailyBuckets).map(([date, count]) => ({ date, count }));

  // Top countries (from users who have a country field)
  const byCountry: Record<string, number> = {};
  for (const u of users) {
    const c = u.country;
    if (c) byCountry[c] = (byCountry[c] ?? 0) + 1;
  }
  const topCountries = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([country, count]) => ({ country, count }));

  return {
    kpis: {
      total:         { value: users.length,                                     change: pctChange(users.length, users.length - inPeriod.length) },
      newThisPeriod: { value: inPeriod.length,                                  change: pctChange(inPeriod.length, inPrev.length) },
      active:        { value: byStatus['active'] ?? 0,                          change: 0 },
      suspended:     { value: (byStatus['suspended'] ?? 0) + (byStatus['frozen'] ?? 0), change: 0 },
      kycApproved:   { value: byKyc['approved'] ?? 0,                           change: 0 },
      kycPending:    { value: byKyc['submitted'] ?? 0,                          change: 0 },
    },
    byStatus,
    byKyc,
    byTier,
    dailyRegistrations,
    topCountries,
    recentUsers: users
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20)
      .map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status, kycStatus: u.kycStatus, tier: u.accountTier, createdAt: u.createdAt })),
  };
}

// ─── 2. TRANSACTIONS REPORT ──────────────────────────────────────────────────

export async function transactionsReport(q: ReportQuery) {
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);
  const rates  = toUsdRate();

  const { data: all } = await queryTransactions({ limit: 100_000 });
  const inPeriod = all.filter(t => t.createdAt >= start);
  const inPrev   = all.filter(t => t.createdAt >= pStart && t.createdAt < start);

  const filtered = inPeriod
    .filter(t => !q.type     || t.type     === q.type)
    .filter(t => !q.status   || t.status   === q.status)
    .filter(t => !q.currency || t.currency === q.currency);

  // Volume in USD
  const volumeUsd = filtered.reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);
  const prevVol   = inPrev.reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);

  // By type
  const byType: Record<string, { count: number; volumeUsd: number }> = {};
  for (const t of inPeriod) {
    if (!byType[t.type]) byType[t.type] = { count: 0, volumeUsd: 0 };
    byType[t.type].count++;
    byType[t.type].volumeUsd += Number(t.amount) * (rates[t.currency] ?? 1);
  }

  // By status
  const byStatus: Record<string, number> = {};
  for (const t of inPeriod) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

  // By currency
  const byCurrency: Record<string, { count: number; volumeUsd: number }> = {};
  for (const t of inPeriod) {
    if (!byCurrency[t.currency]) byCurrency[t.currency] = { count: 0, volumeUsd: 0 };
    byCurrency[t.currency].count++;
    byCurrency[t.currency].volumeUsd += Number(t.amount) * (rates[t.currency] ?? 1);
  }

  // Daily volume
  const dailyBuckets = buildDailyBuckets(start);
  const dailyCount   = buildDailyBuckets(start);
  for (const t of inPeriod) {
    const day = t.createdAt.slice(0, 10);
    if (day in dailyBuckets) {
      dailyBuckets[day] += Number(t.amount) * (rates[t.currency] ?? 1);
      dailyCount[day]++;
    }
  }
  const daily = Object.entries(dailyBuckets).map(([date, volumeUsd]) => ({ date, volumeUsd: +volumeUsd.toFixed(2), count: dailyCount[date] ?? 0 }));

  // Flagged
  const flagged = inPeriod.filter(t => t.flagged).length;

  return {
    kpis: {
      total:     { value: inPeriod.length,         change: pctChange(inPeriod.length, inPrev.length) },
      volumeUsd: { value: +volumeUsd.toFixed(2),   change: pctChange(volumeUsd, prevVol) },
      flagged:   { value: flagged,                  change: 0 },
      pending:   { value: byStatus['pending'] ?? 0, change: 0 },
      failed:    { value: byStatus['failed']  ?? 0, change: 0 },
      completed: { value: byStatus['completed'] ?? 0, change: 0 },
    },
    byType,
    byStatus,
    byCurrency,
    daily,
    recent: inPeriod.slice(0, 25).map(t => ({
      id: t.id, type: t.type, status: t.status, userName: t.userName,
      amount: t.amount, currency: t.currency, reference: t.reference,
      createdAt: t.createdAt, flagged: t.flagged,
    })),
  };
}

// ─── 3. REVENUE REPORT ───────────────────────────────────────────────────────

export async function revenueReport(q: ReportQuery) {
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);
  const rates  = toUsdRate();

  const { data: all } = await queryTransactions({ limit: 100_000 });
  const fees     = all.filter(t => t.type === 'fee' && t.status === 'completed');
  const inPeriod = fees.filter(t => t.createdAt >= start);
  const inPrev   = fees.filter(t => t.createdAt >= pStart && t.createdAt < start);

  const revenue     = inPeriod.reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);
  const prevRevenue = inPrev.reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);

  // Daily revenue
  const dailyBuckets = buildDailyBuckets(start);
  for (const t of inPeriod) {
    const day = t.createdAt.slice(0, 10);
    if (day in dailyBuckets) dailyBuckets[day] += Number(t.amount) * (rates[t.currency] ?? 1);
  }
  const daily = Object.entries(dailyBuckets).map(([date, revenue]) => ({ date, revenue: +revenue.toFixed(2) }));

  // Revenue by currency
  const byCurrency: Record<string, number> = {};
  for (const t of inPeriod) {
    byCurrency[t.currency] = (byCurrency[t.currency] ?? 0) + Number(t.amount) * (rates[t.currency] ?? 1);
  }

  // All-time total
  const allTimeRevenue = fees.reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);

  // Monthly breakdown (last 12 months)
  const monthly: Record<string, number> = {};
  for (const t of fees) {
    const mo = t.createdAt.slice(0, 7);
    monthly[mo] = (monthly[mo] ?? 0) + Number(t.amount) * (rates[t.currency] ?? 1);
  }
  const monthlyArr = Object.entries(monthly)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, revenue]) => ({ month, revenue: +revenue.toFixed(2) }));

  return {
    kpis: {
      periodRevenue: { value: +revenue.toFixed(2),     change: pctChange(revenue, prevRevenue) },
      allTime:       { value: +allTimeRevenue.toFixed(2), change: 0 },
      feeCount:      { value: inPeriod.length,          change: pctChange(inPeriod.length, inPrev.length) },
      avgFee:        { value: inPeriod.length > 0 ? +(revenue / inPeriod.length).toFixed(2) : 0, change: 0 },
    },
    daily,
    monthly: monthlyArr,
    byCurrency,
  };
}

// ─── 4. DEPOSITS REPORT ──────────────────────────────────────────────────────

export async function depositsReport(q: ReportQuery) {
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);
  const rates  = toUsdRate();
  const CREDIT = new Set(['deposit', 'manual_credit', 'refund', 'crypto_sell']);

  const { data: all } = await queryTransactions({ limit: 100_000 });
  const deps     = all.filter(t => CREDIT.has(t.type));
  const inPeriod = deps.filter(t => t.createdAt >= start);
  const inPrev   = deps.filter(t => t.createdAt >= pStart && t.createdAt < start);

  const totalUsd = inPeriod.filter(t => t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);
  const prevUsd  = inPrev.filter(t => t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);

  const byStatus: Record<string, number> = {};
  for (const t of inPeriod) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

  const byCurrency: Record<string, { count: number; volumeUsd: number }> = {};
  for (const t of inPeriod) {
    if (!byCurrency[t.currency]) byCurrency[t.currency] = { count: 0, volumeUsd: 0 };
    byCurrency[t.currency].count++;
    byCurrency[t.currency].volumeUsd += Number(t.amount) * (rates[t.currency] ?? 1);
  }

  const byType: Record<string, { count: number; volumeUsd: number }> = {};
  for (const t of inPeriod) {
    if (!byType[t.type]) byType[t.type] = { count: 0, volumeUsd: 0 };
    byType[t.type].count++;
    byType[t.type].volumeUsd += Number(t.amount) * (rates[t.currency] ?? 1);
  }

  const dailyBuckets = buildDailyBuckets(start);
  for (const t of inPeriod.filter(t => t.status === 'completed')) {
    const day = t.createdAt.slice(0, 10);
    if (day in dailyBuckets) dailyBuckets[day] += Number(t.amount) * (rates[t.currency] ?? 1);
  }
  const daily = Object.entries(dailyBuckets).map(([date, volumeUsd]) => ({ date, volumeUsd: +volumeUsd.toFixed(2) }));

  return {
    kpis: {
      totalUsd:  { value: +totalUsd.toFixed(2),  change: pctChange(totalUsd, prevUsd) },
      count:     { value: inPeriod.length,        change: pctChange(inPeriod.length, inPrev.length) },
      pending:   { value: byStatus['pending'] ?? 0, change: 0 },
      avgUsd:    { value: inPeriod.length > 0 ? +(totalUsd / inPeriod.length).toFixed(2) : 0, change: 0 },
    },
    byStatus,
    byCurrency,
    byType,
    daily,
  };
}

// ─── 5. WITHDRAWALS REPORT ───────────────────────────────────────────────────

export async function withdrawalsReport(q: ReportQuery) {
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);
  const rates  = toUsdRate();
  const DEBIT  = new Set(['withdrawal', 'manual_debit', 'wire_transfer', 'crypto_buy']);

  const { data: all } = await queryTransactions({ limit: 100_000 });
  const wds      = all.filter(t => DEBIT.has(t.type));
  const inPeriod = wds.filter(t => t.createdAt >= start);
  const inPrev   = wds.filter(t => t.createdAt >= pStart && t.createdAt < start);

  const totalUsd = inPeriod.filter(t => t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);
  const prevUsd  = inPrev.filter(t => t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);

  const byStatus: Record<string, number> = {};
  for (const t of inPeriod) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

  const byCurrency: Record<string, { count: number; volumeUsd: number }> = {};
  for (const t of inPeriod) {
    if (!byCurrency[t.currency]) byCurrency[t.currency] = { count: 0, volumeUsd: 0 };
    byCurrency[t.currency].count++;
    byCurrency[t.currency].volumeUsd += Number(t.amount) * (rates[t.currency] ?? 1);
  }

  const byType: Record<string, { count: number; volumeUsd: number }> = {};
  for (const t of inPeriod) {
    if (!byType[t.type]) byType[t.type] = { count: 0, volumeUsd: 0 };
    byType[t.type].count++;
    byType[t.type].volumeUsd += Number(t.amount) * (rates[t.currency] ?? 1);
  }

  const dailyBuckets = buildDailyBuckets(start);
  for (const t of inPeriod.filter(t => t.status === 'completed')) {
    const day = t.createdAt.slice(0, 10);
    if (day in dailyBuckets) dailyBuckets[day] += Number(t.amount) * (rates[t.currency] ?? 1);
  }
  const daily = Object.entries(dailyBuckets).map(([date, volumeUsd]) => ({ date, volumeUsd: +volumeUsd.toFixed(2) }));

  return {
    kpis: {
      totalUsd:  { value: +totalUsd.toFixed(2),  change: pctChange(totalUsd, prevUsd) },
      count:     { value: inPeriod.length,        change: pctChange(inPeriod.length, inPrev.length) },
      pending:   { value: byStatus['pending'] ?? 0, change: 0 },
      avgUsd:    { value: inPeriod.length > 0 ? +(totalUsd / inPeriod.length).toFixed(2) : 0, change: 0 },
    },
    byStatus,
    byCurrency,
    byType,
    daily,
  };
}

// ─── 6. EXCHANGE REPORT ──────────────────────────────────────────────────────

export async function exchangeReport(q: ReportQuery) {
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);
  const rates  = toUsdRate();
  const EX_TYPES = new Set(['crypto_buy', 'crypto_sell']);

  const { data: all } = await queryTransactions({ limit: 100_000 });
  const exs      = all.filter(t => EX_TYPES.has(t.type));
  const inPeriod = exs.filter(t => t.createdAt >= start);
  const inPrev   = exs.filter(t => t.createdAt >= pStart && t.createdAt < start);

  const totalUsd = inPeriod.filter(t => t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);
  const prevUsd  = inPrev.filter(t => t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount) * (rates[t.currency] ?? 1), 0);

  const byPair: Record<string, { count: number; volumeUsd: number }> = {};
  for (const t of inPeriod) {
    const pair = t.currency + '/USD';
    if (!byPair[pair]) byPair[pair] = { count: 0, volumeUsd: 0 };
    byPair[pair].count++;
    byPair[pair].volumeUsd += Number(t.amount) * (rates[t.currency] ?? 1);
  }

  const byType: Record<string, { count: number; volumeUsd: number }> = {};
  for (const t of inPeriod) {
    if (!byType[t.type]) byType[t.type] = { count: 0, volumeUsd: 0 };
    byType[t.type].count++;
    byType[t.type].volumeUsd += Number(t.amount) * (rates[t.currency] ?? 1);
  }

  const dailyBuckets = buildDailyBuckets(start);
  for (const t of inPeriod.filter(t => t.status === 'completed')) {
    const day = t.createdAt.slice(0, 10);
    if (day in dailyBuckets) dailyBuckets[day] += Number(t.amount) * (rates[t.currency] ?? 1);
  }
  const daily = Object.entries(dailyBuckets).map(([date, volumeUsd]) => ({ date, volumeUsd: +volumeUsd.toFixed(2) }));

  // Live rates snapshot
  const cfg = readRatesConfig();
  const liveRates = [
    { pair: 'BTC/USD', rate: cfg.rates.BTC_USD },
    { pair: 'ETH/USD', rate: cfg.rates.ETH_USD },
    { pair: 'SOL/USD', rate: cfg.rates.SOL_USD },
    { pair: 'BNB/USD', rate: cfg.rates.BNB_USD },
    { pair: 'USDT/USD', rate: cfg.rates.USDT_USD },
    { pair: 'EUR/USD', rate: cfg.rates.EUR_USD },
    { pair: 'GBP/USD', rate: cfg.rates.GBP_USD },
  ];

  return {
    kpis: {
      totalUsd:  { value: +totalUsd.toFixed(2),  change: pctChange(totalUsd, prevUsd) },
      count:     { value: inPeriod.length,        change: pctChange(inPeriod.length, inPrev.length) },
      buys:      { value: byType['crypto_buy']?.count  ?? 0, change: 0 },
      sells:     { value: byType['crypto_sell']?.count ?? 0, change: 0 },
    },
    byPair,
    byType,
    daily,
    liveRates,
  };
}

// ─── 7. KYC REPORT ───────────────────────────────────────────────────────────

export async function kycReport(q: ReportQuery) {
  const users  = await loadAllUsers();
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);

  const byStatus: Record<string, number> = {};
  for (const u of users) byStatus[u.kycStatus ?? 'not_submitted'] = (byStatus[u.kycStatus ?? 'not_submitted'] ?? 0) + 1;

  // Submissions in period
  const submitted = users.filter(u => u.kycSubmittedAt && u.kycSubmittedAt >= start);
  const prevSub   = users.filter(u => u.kycSubmittedAt && u.kycSubmittedAt >= pStart && u.kycSubmittedAt < start);

  // Approvals in period
  const approved  = users.filter(u => u.kycApprovedAt && u.kycApprovedAt >= start);
  const prevApp   = users.filter(u => u.kycApprovedAt && u.kycApprovedAt >= pStart && u.kycApprovedAt < start);

  // Rejections in period
  const rejected  = users.filter(u => u.kycRejectedAt && u.kycRejectedAt >= start);

  // KYC expiry is not stored by the current schema.
  const expiringSoon = 0;
  const expired = 0;

  // Approval rate
  const totalDecided = (byStatus['approved'] ?? 0) + (byStatus['rejected'] ?? 0);
  const approvalRate = totalDecided > 0 ? +((byStatus['approved'] ?? 0) / totalDecided * 100).toFixed(1) : 0;

  // Daily submissions
  const dailyBuckets = buildDailyBuckets(start);
  for (const u of submitted) {
    const day = u.kycSubmittedAt!.slice(0, 10);
    if (day in dailyBuckets) dailyBuckets[day]++;
  }
  const daily = Object.entries(dailyBuckets).map(([date, count]) => ({ date, count }));

  // Rejection reasons
  const rejectionReasons: Record<string, number> = {};
  for (const u of users.filter(u => u.kycStatus === 'rejected')) {
    const reason = u.kycRejectionReason ?? 'unspecified';
    rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
  }

  return {
    kpis: {
      total:         { value: users.length,                 change: 0 },
      submitted:     { value: submitted.length,             change: pctChange(submitted.length, prevSub.length) },
      approved:      { value: approved.length,              change: pctChange(approved.length, prevApp.length) },
      rejected:      { value: rejected.length,              change: 0 },
      expiringSoon:  { value: expiringSoon,                 change: 0 },
      approvalRate:  { value: approvalRate,                 change: 0 },
    },
    byStatus,
    daily,
    rejectionReasons,
    expired,
    queue: users
      .filter(u => u.kycStatus === 'submitted')
      .sort((a, b) => (b.kycSubmittedAt ?? '').localeCompare(a.kycSubmittedAt ?? ''))
      .slice(0, 20)
      .map(u => ({ id: u.id, name: u.name, email: u.email, kycStatus: u.kycStatus, kycSubmittedAt: u.kycSubmittedAt, tier: u.accountTier })),
  };
}

// ─── 8. AML REPORT ───────────────────────────────────────────────────────────

export async function amlReport(q: ReportQuery) {
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);
  const rates  = toUsdRate();

  const { data: all } = await queryTransactions({ limit: 100_000 });
  const flagged    = all.filter(t => t.flagged);
  const inPeriod   = flagged.filter(t => t.createdAt >= start);
  const inPrev     = flagged.filter(t => t.createdAt >= pStart && t.createdAt < start);

  const users = await loadAllUsers();
  const frozenUsers    = users.filter(u => u.status === 'frozen').length;
  const suspendedUsers = users.filter(u => u.status === 'suspended').length;

  // High-value transactions (> $10k)
  const highValue = all.filter(t => t.createdAt >= start && Number(t.amount) * (rates[t.currency] ?? 1) > 10_000);

  // Flagged by type
  const byType: Record<string, number> = {};
  for (const t of inPeriod) byType[t.type] = (byType[t.type] ?? 0) + 1;

  // Flagged by currency
  const byCurrency: Record<string, number> = {};
  for (const t of inPeriod) byCurrency[t.currency] = (byCurrency[t.currency] ?? 0) + 1;

  // Daily flagged
  const dailyBuckets = buildDailyBuckets(start);
  for (const t of inPeriod) {
    const day = t.createdAt.slice(0, 10);
    if (day in dailyBuckets) dailyBuckets[day]++;
  }
  const daily = Object.entries(dailyBuckets).map(([date, count]) => ({ date, count }));

  // Top flagged users
  const userFlagCount: Record<string, { name: string; email: string; count: number; volumeUsd: number }> = {};
  for (const t of inPeriod) {
    if (!userFlagCount[t.userId]) userFlagCount[t.userId] = { name: t.userName, email: t.userEmail, count: 0, volumeUsd: 0 };
    userFlagCount[t.userId].count++;
    userFlagCount[t.userId].volumeUsd += Number(t.amount) * (rates[t.currency] ?? 1);
  }
  const topFlaggedUsers = Object.entries(userFlagCount)
    .sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    .map(([id, v]) => ({ id, ...v, volumeUsd: +v.volumeUsd.toFixed(2) }));

  return {
    kpis: {
      flaggedTxs:   { value: inPeriod.length,    change: pctChange(inPeriod.length, inPrev.length) },
      highValue:    { value: highValue.length,    change: 0 },
      frozenUsers:  { value: frozenUsers,         change: 0 },
      suspended:    { value: suspendedUsers,      change: 0 },
      totalFlagged: { value: flagged.length,      change: 0 },
    },
    byType,
    byCurrency,
    daily,
    topFlaggedUsers,
    recentFlagged: inPeriod.slice(0, 20).map(t => ({
      id: t.id, type: t.type, status: t.status, userName: t.userName,
      amount: t.amount, currency: t.currency, reference: t.reference, createdAt: t.createdAt,
    })),
  };
}

// ─── 9. SUPPORT REPORT ───────────────────────────────────────────────────────

export async function supportReport(q: ReportQuery) {
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);

  const all = await listSupportConversationsForReport();
  const totalAll = all.length;
  const openCount = all.filter(c => c.status === 'open').length;
  const resolvedCount = all.filter(c => c.status === 'resolved').length;
  const pendingCount = all.filter(c => c.status === 'pending').length;

  const inPeriod = all.filter(c => c.createdAt >= start);
  const inPrev   = all.filter(c => c.createdAt >= pStart && c.createdAt < start);

  // By status
  const byStatus: Record<string, number> = {};
  for (const c of inPeriod) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

  // By priority
  const byPriority: Record<string, number> = {};
  for (const c of inPeriod) {
    const p = (c as unknown as Record<string, unknown>).priority as string | undefined ?? 'normal';
    byPriority[p] = (byPriority[p] ?? 0) + 1;
  }

  // By channel
  const byChannel: Record<string, number> = {};
  for (const c of inPeriod) {
    const ch = (c as unknown as Record<string, unknown>).channel as string | undefined ?? 'email';
    byChannel[ch] = (byChannel[ch] ?? 0) + 1;
  }

  // Daily tickets
  const dailyBuckets = buildDailyBuckets(start);
  for (const c of inPeriod) {
    const day = c.createdAt.slice(0, 10);
    if (day in dailyBuckets) dailyBuckets[day]++;
  }
  const daily = Object.entries(dailyBuckets).map(([date, count]) => ({ date, count }));

  // Avg resolution time (hours) — from resolved tickets with resolvedAt
  const resolved = inPeriod.filter(c => c.status === 'resolved' && (c as unknown as Record<string, unknown>).resolvedAt);
  const avgResolutionHrs = resolved.length > 0
    ? +(resolved.reduce((s, c) => {
        const created  = new Date(c.createdAt).getTime();
        const resolved = new Date((c as unknown as Record<string, unknown>).resolvedAt as string).getTime();
        return s + (resolved - created) / 3_600_000;
      }, 0) / resolved.length).toFixed(1)
    : 0;

  return {
    kpis: {
      total:          { value: inPeriod.length,  change: pctChange(inPeriod.length, inPrev.length) },
      open:           { value: openCount,         change: 0 },
      resolved:       { value: resolvedCount,     change: 0 },
      pending:        { value: pendingCount,       change: 0 },
      avgResolutionHrs: { value: avgResolutionHrs, change: 0 },
    },
    byStatus,
    byPriority,
    byChannel,
    daily,
    totalAll,
  };
}

// ─── 10. EMAILS REPORT ───────────────────────────────────────────────────────

const EMAIL_LOG_FILE = privateSubdirectory('email/email-log.jsonl');

interface EmailLogEntry {
  id: string; ts: string; to: string; subject: string;
  template: string; status: 'sent' | 'failed' | 'queued' | 'bounced';
  error?: string; provider?: string;
}

function loadEmailLog(): EmailLogEntry[] {
  try {
    if (!fs.existsSync(EMAIL_LOG_FILE)) return [];
    return fs.readFileSync(EMAIL_LOG_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as EmailLogEntry);
  } catch { return []; }
}

export function emailsReport(q: ReportQuery) {
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);

  const all      = loadEmailLog();
  const inPeriod = all.filter(e => e.ts >= start);
  const inPrev   = all.filter(e => e.ts >= pStart && e.ts < start);

  const sent    = inPeriod.filter(e => e.status === 'sent').length;
  const failed  = inPeriod.filter(e => e.status === 'failed').length;
  const bounced = inPeriod.filter(e => e.status === 'bounced').length;
  const queued  = inPeriod.filter(e => e.status === 'queued').length;

  const deliveryRate = inPeriod.length > 0 ? +((sent / inPeriod.length) * 100).toFixed(1) : 0;

  const byTemplate: Record<string, { count: number; sent: number; failed: number }> = {};
  for (const e of inPeriod) {
    if (!byTemplate[e.template]) byTemplate[e.template] = { count: 0, sent: 0, failed: 0 };
    byTemplate[e.template].count++;
    if (e.status === 'sent')   byTemplate[e.template].sent++;
    if (e.status === 'failed') byTemplate[e.template].failed++;
  }

  const byProvider: Record<string, number> = {};
  for (const e of inPeriod) {
    const p = e.provider ?? 'unknown';
    byProvider[p] = (byProvider[p] ?? 0) + 1;
  }

  const dailyBuckets = buildDailyBuckets(start);
  const dailySent    = buildDailyBuckets(start);
  const dailyFailed  = buildDailyBuckets(start);
  for (const e of inPeriod) {
    const day = e.ts.slice(0, 10);
    if (day in dailyBuckets) {
      dailyBuckets[day]++;
      if (e.status === 'sent')   dailySent[day]++;
      if (e.status === 'failed') dailyFailed[day]++;
    }
  }
  const daily = Object.entries(dailyBuckets).map(([date, total]) => ({
    date, total, sent: dailySent[date] ?? 0, failed: dailyFailed[date] ?? 0,
  }));

  return {
    kpis: {
      total:        { value: inPeriod.length, change: pctChange(inPeriod.length, inPrev.length) },
      sent:         { value: sent,            change: 0 },
      failed:       { value: failed,          change: 0 },
      bounced:      { value: bounced,         change: 0 },
      queued:       { value: queued,          change: 0 },
      deliveryRate: { value: deliveryRate,    change: 0 },
    },
    byTemplate,
    byProvider,
    daily,
    recentFailed: inPeriod.filter(e => e.status === 'failed').slice(0, 20),
  };
}

// ─── 11. SECURITY REPORT ─────────────────────────────────────────────────────

export function securityReport(q: ReportQuery) {
  const start  = periodStart(q.period);
  const pStart = prevPeriodStart(q.period);

  // Security alerts
  const allAlerts = loadAlerts(2000);
  const inPeriod  = allAlerts.filter(a => a.ts >= start);
  const inPrev    = allAlerts.filter(a => a.ts >= pStart && a.ts < start);

  const bySeverity: Record<string, number> = {};
  for (const a of inPeriod) bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;

  const byType: Record<string, number> = {};
  for (const a of inPeriod) byType[a.type] = (byType[a.type] ?? 0) + 1;

  const resolved   = inPeriod.filter(a => a.resolved).length;
  const unresolved = inPeriod.filter(a => !a.resolved).length;

  // Login history from security log
  const LOGIN_LOG = privateSubdirectory('security/login-log.jsonl');
  let loginEvents: Array<{ ts: string; result: string; actor: string; ip: string }> = [];
  try {
    if (fs.existsSync(LOGIN_LOG)) {
      loginEvents = fs.readFileSync(LOGIN_LOG, 'utf8')
        .split('\n').filter(Boolean)
        .map(l => JSON.parse(l));
    }
  } catch { /* silent */ }

  const logins   = loginEvents.filter(e => e.ts >= start);
  const prevLogins = loginEvents.filter(e => e.ts >= pStart && e.ts < start);

  const loginByResult: Record<string, number> = {};
  for (const e of logins) loginByResult[e.result] = (loginByResult[e.result] ?? 0) + 1;

  // Daily alerts
  const dailyBuckets = buildDailyBuckets(start);
  for (const a of inPeriod) {
    const day = a.ts.slice(0, 10);
    if (day in dailyBuckets) dailyBuckets[day]++;
  }
  const daily = Object.entries(dailyBuckets).map(([date, count]) => ({ date, count }));

  return {
    kpis: {
      alerts:       { value: inPeriod.length,                    change: pctChange(inPeriod.length, inPrev.length) },
      critical:     { value: bySeverity['critical'] ?? 0,        change: 0 },
      unresolved:   { value: unresolved,                         change: 0 },
      loginAttempts:{ value: logins.length,                      change: pctChange(logins.length, prevLogins.length) },
      failedLogins: { value: loginByResult['failed'] ?? 0,       change: 0 },
      blocked:      { value: loginByResult['blocked'] ?? 0,      change: 0 },
    },
    bySeverity,
    byType,
    loginByResult,
    daily,
    resolved,
    unresolved,
    recentAlerts: inPeriod.slice(0, 20),
  };
}
