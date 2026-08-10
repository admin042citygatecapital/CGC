import type { Request, Response } from 'express';
import fs from 'node:fs';
import type { AnalyticsEvent } from '../event/POST.js';
import { CONVERSION_TYPES } from '../event/POST.js';
import { privateSubdirectory } from '../../../lib/storagePaths.js';

const DATA_FILE = privateSubdirectory('analytics/events.jsonl');

function readEvents(): AnalyticsEvent[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const events: AnalyticsEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { events.push(JSON.parse(trimmed) as AnalyticsEvent); } catch { /* skip */ }
  }
  return events;
}

export default function handler(req: Request, res: Response) {
  try {
    const days = Math.min(Number(req.query.days ?? 30), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const all = readEvents().filter(e => new Date(e.timestamp) >= since);
    const pageviews = all.filter(e => e.type === 'pageview').length;
    const conversions = all.filter(e => CONVERSION_TYPES.includes(e.type));

    // Count per conversion type
    const byType: Record<string, number> = {};
    for (const t of CONVERSION_TYPES) byType[t] = 0;
    for (const e of conversions) byType[e.type] = (byType[e.type] ?? 0) + 1;

    // Funnel: ordered steps
    const funnel = [
      { step: 'Page Views',         type: 'pageview',          count: pageviews },
      { step: 'Signup Started',     type: 'signup_started',    count: byType['signup_started'] ?? 0 },
      { step: 'Plan Selected',      type: 'plan_selected',     count: byType['plan_selected'] ?? 0 },
      { step: 'Signup Completed',   type: 'signup_completed',  count: byType['signup_completed'] ?? 0 },
      { step: 'Account Opened',     type: 'account_open',      count: byType['account_open'] ?? 0 },
      { step: 'Transfer Initiated', type: 'transfer_initiated',count: byType['transfer_initiated'] ?? 0 },
    ];

    // Daily trend per conversion type (last N days)
    const dailyMap = new Map<string, Record<string, number>>();
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      dailyMap.set(d, Object.fromEntries(CONVERSION_TYPES.map(t => [t, 0])));
    }
    for (const e of conversions) {
      const day = e.timestamp.slice(0, 10);
      const entry = dailyMap.get(day);
      if (entry) entry[e.type] = (entry[e.type] ?? 0) + 1;
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Plan breakdown from meta
    const planCounts: Record<string, number> = {};
    for (const e of conversions.filter(e => e.type === 'plan_selected')) {
      const plan = String(e.meta?.plan ?? 'unknown');
      planCounts[plan] = (planCounts[plan] ?? 0) + 1;
    }

    // Conversion rate: signup_started / pageviews
    const conversionRate = pageviews > 0
      ? ((byType['signup_started'] ?? 0) / pageviews * 100).toFixed(2)
      : '0.00';

    res.json({
      period: { days, since: since.toISOString() },
      totals: { pageviews, conversions: conversions.length, conversionRate: `${conversionRate}%` },
      byType,
      funnel,
      dailyTrend,
      planBreakdown: Object.entries(planCounts).map(([plan, count]) => ({ plan, count })),
    });
  } catch (err) {
    console.error('analytics.conversions.error', err);
    res.status(500).json({ error: 'Failed to load conversion data' });
  }
}
