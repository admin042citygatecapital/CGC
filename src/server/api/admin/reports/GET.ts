/**
 * GET /api/admin/reports
 * Query: type (customers|transactions|revenue|deposits|withdrawals|
 *              exchange|kyc|aml|support|emails|security), period, currency?,
 *              txType?, status?
 */
import type { Request, Response } from 'express';
import {
  customersReport, transactionsReport, revenueReport, depositsReport, withdrawalsReport,
  exchangeReport, kycReport, amlReport, supportReport, emailsReport, securityReport,
  type Period, type ReportQuery,
} from '../../../lib/reportsStore.js';
import { isOneOf } from '../../../lib/inputValidator.js';

const REPORT_TYPES = [
  'customers', 'transactions', 'revenue', 'deposits', 'withdrawals',
  'exchange', 'kyc', 'aml', 'support', 'emails', 'security',
] as const;
const PERIODS = ['7d', '30d', '90d', 'ytd', 'all'] as const satisfies readonly Period[];

export default async function handler(req: Request, res: Response) {
  const q = req.query as Record<string, string | undefined>;
  const type = isOneOf(q.type, REPORT_TYPES) ?? 'customers';
  const period = isOneOf(q.period, PERIODS) ?? '30d';

  const query: ReportQuery = { period, currency: q.currency, type: q.txType, status: q.status };

  const reports: Record<typeof REPORT_TYPES[number], () => unknown> = {
    customers:    () => customersReport(query),
    transactions: () => transactionsReport(query),
    revenue:      () => revenueReport(query),
    deposits:     () => depositsReport(query),
    withdrawals:  () => withdrawalsReport(query),
    exchange:     () => exchangeReport(query),
    kyc:          () => kycReport(query),
    aml:          () => amlReport(query),
    support:      () => supportReport(query),
    emails:       () => emailsReport(query),
    security:     () => securityReport(query),
  };

  const report = await reports[type]();
  return res.json({ ok: true, type, period, report });
}
