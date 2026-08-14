/**
 * GET /api/admin/reports
 * Query params:
 *   type    — customers | transactions | revenue | deposits | withdrawals
 *             | exchange | kyc | aml | support | emails | security
 *   period  — 7d | 30d | 90d | ytd | all  (default: 30d)
 *   currency — optional currency filter (transactions/deposits/withdrawals)
 *   txType   — optional transaction type filter
 *   status   — optional status filter
 *   format   — json (default) | csv
 */
import type { Request, Response } from 'express';
import {
  customersReport,
  transactionsReport,
  revenueReport,
  depositsReport,
  withdrawalsReport,
  exchangeReport,
  kycReport,
  amlReport,
  supportReport,
  emailsReport,
  securityReport,
  type Period,
} from '../../../lib/reportsStore.js';

const VALID_TYPES = new Set([
  'customers','transactions','revenue','deposits','withdrawals',
  'exchange','kyc','aml','support','emails','security',
]);

const VALID_PERIODS = new Set(['7d','30d','90d','ytd','all']);

export default async function handler(req: Request, res: Response) {
  try {
    const type     = String(req.query.type   ?? 'transactions');
    const period   = String(req.query.period ?? '30d') as Period;
    const currency = String(req.query.currency ?? '');
    const txType   = String(req.query.txType   ?? '');
    const status   = String(req.query.status   ?? '');
    const format   = String(req.query.format   ?? 'json');

    if (!VALID_TYPES.has(type))    return res.status(400).json({ error: `Invalid type: ${type}` });
    if (!VALID_PERIODS.has(period)) return res.status(400).json({ error: `Invalid period: ${period}` });

    const q = { period, currency: currency || undefined, type: txType || undefined, status: status || undefined };

    let data: unknown;
    switch (type) {
      case 'customers':     data = await customersReport(q);     break;
      case 'transactions':  data = await transactionsReport(q);  break;
      case 'revenue':       data = await revenueReport(q);       break;
      case 'deposits':      data = await depositsReport(q);      break;
      case 'withdrawals':   data = await withdrawalsReport(q);   break;
      case 'exchange':      data = await exchangeReport(q);      break;
      case 'kyc':           data = await kycReport(q);           break;
      case 'aml':           data = await amlReport(q);           break;
      case 'support':       data = await supportReport(q); break;
      case 'emails':        data = await emailsReport(q);   break;
      case 'security':      data = await securityReport(q); break;
      default:              return res.status(400).json({ error: 'Unknown report type' });
    }

    if (format === 'csv') {
      // Generic CSV export: flatten kpis + daily series
      const d = data as Record<string, unknown>;
      const kpis = d.kpis as Record<string, { value: number; change: number }> | undefined;
      const daily = (d.daily ?? d.dailyRegistrations) as Array<Record<string, unknown>> | undefined;

      let csv = `City Gate Capital — ${type.charAt(0).toUpperCase() + type.slice(1)} Report\n`;
      csv += `Period: ${period}\nGenerated: ${new Date().toISOString()}\n\n`;

      if (kpis) {
        csv += 'KPIs\nMetric,Value,Change %\n';
        for (const [k, v] of Object.entries(kpis)) {
          csv += `${k},${v.value},${v.change}\n`;
        }
        csv += '\n';
      }

      if (daily && daily.length > 0) {
        const headers = Object.keys(daily[0]).join(',');
        csv += `Daily Series\n${headers}\n`;
        for (const row of daily) csv += Object.values(row).join(',') + '\n';
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="cgc-${type}-report-${new Date().toISOString().slice(0,10)}.csv"`);
      return res.send(csv);
    }

    res.json({ type, period, generatedAt: new Date().toISOString(), data });
  } catch (err) {
    console.error('[reports]', err);
    res.status(500).json({ error: 'Report generation failed', message: String(err) });
  }
}
