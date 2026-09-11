import type { Request, Response } from 'express';
import { CONVERSION_TYPES } from '../event/POST.js';
import {
  MAX_REPORT_DAYS,
  parseReportDays,
  readEventsFile,
  reportWindowStartUtc,
  utcDayKey,
} from '../reportShared.js';

export default function handler(req: Request, res: Response) {
  try {
    const days = parseReportDays(req);
    if (days === null) {
      return res.status(400).json({ error: `days must be an integer between 1 and ${MAX_REPORT_DAYS}` });
    }
    const since = reportWindowStartUtc(days);

    const { events, malformedLines } = readEventsFile();
    const all = events.filter(e => new Date(e.timestamp) >= since);
    const pageviews = all.filter(e => e.type === 'pageview').length;
    const conversions = all.filter(e => CONVERSION_TYPES.includes(e.type));

    // Count per conversion type (keys come from the fixed CONVERSION_TYPES
    // enum, not from request data).
    const byType: Record<string, number> = {};
    for (const t of CONVERSION_TYPES) byType[t] = 0;
    for (const e of conversions) byType[e.type] = (byType[e.type] ?? 0) + 1;

    // Funnel: independent event totals per step, NOT a cohort funnel. A
    // visitor who starts signup on day one and completes it on day two is
    // counted in both steps, and no step is guaranteed to be a subset of the
    // one above it — so step-to-step "dropoff" is indicative only.
    const funnel = [
      { step: 'Page Views',         type: 'pageview',          count: pageviews },
      { step: 'Signup Started',     type: 'signup_started',    count: byType['signup_started'] ?? 0 },
      { step: 'Plan Selected',      type: 'plan_selected',     count: byType['plan_selected'] ?? 0 },
      { step: 'Signup Completed',   type: 'signup_completed',  count: byType['signup_completed'] ?? 0 },
      { step: 'Account Opened',     type: 'account_open',      count: byType['account_open'] ?? 0 },
      { step: 'Transfer Initiated', type: 'transfer_initiated',count: byType['transfer_initiated'] ?? 0 },
    ];

    // Daily trend per conversion type, keyed on UTC calendar dates matching
    // the window start (see reportWindowStartUtc).
    const dailyMap = new Map<string, Record<string, number>>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      dailyMap.set(d.toISOString().slice(0, 10), Object.fromEntries(CONVERSION_TYPES.map(t => [t, 0])));
    }
    for (const e of conversions) {
      const entry = dailyMap.get(utcDayKey(e.timestamp));
      if (entry) entry[e.type] = (entry[e.type] ?? 0) + 1;
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Plan breakdown. A Map keeps attacker-controlled meta values (e.g.
    // `plan: "__proto__"`, `plan: "constructor"`) from touching object
    // internals.
    const planCounts = new Map<string, number>();
    for (const e of conversions.filter(e => e.type === 'plan_selected')) {
      const plan = String(e.meta?.plan ?? 'unknown');
      planCounts.set(plan, (planCounts.get(plan) ?? 0) + 1);
    }

    // Signup-start rate: signup_started clicks / page views. This measures how
    // often a page view leads to opening the signup flow — it is not an
    // account-opening conversion rate.
    const signupStartRate = pageviews > 0
      ? ((byType['signup_started'] ?? 0) / pageviews * 100).toFixed(2)
      : '0.00';

    res.json({
      period: { days, since: since.toISOString(), timezone: 'UTC' },
      totals: { pageviews, conversions: conversions.length, signupStartRate: `${signupStartRate}%` },
      byType,
      funnel,
      dailyTrend,
      planBreakdown: Array.from(planCounts.entries()).map(([plan, count]) => ({ plan, count })),
      dataQuality: { malformedLines },
    });
  } catch (err) {
    console.error('analytics.conversions.error', err);
    res.status(500).json({ error: 'Failed to load conversion data' });
  }
}