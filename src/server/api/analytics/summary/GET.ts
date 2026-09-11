import type { Request, Response } from 'express';
import {
  MAX_REPORT_DAYS,
  parseReportDays,
  readEventsFile,
  reportWindowStartUtc,
  utcDayKey,
} from '../reportShared.js';

function countBy<T>(items: T[], key: (item: T) => string): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default function handler(req: Request, res: Response) {
  try {
    const days = parseReportDays(req);
    if (days === null) {
      return res.status(400).json({ error: `days must be an integer between 1 and ${MAX_REPORT_DAYS}` });
    }
    const since = reportWindowStartUtc(days);

    const { events: all, malformedLines } = readEventsFile();
    const filtered = all.filter(e => new Date(e.timestamp) >= since);
    const pageviews = filtered.filter(e => e.type === 'pageview');

    // Daily pageview trend, keyed on UTC calendar dates. The window start is a
    // UTC midnight, so every event counted in `totals` falls inside one of
    // these buckets and vice versa.
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const e of pageviews) {
      const day = utcDayKey(e.timestamp);
      if (dailyMap.has(day)) dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Unique sessions
    const uniqueSessions = new Set(pageviews.map(e => e.sessionId).filter(Boolean)).size;

    // Top pages
    const topPages = countBy(pageviews, e => e.page).slice(0, 10);

    // Referrers
    const referrers = countBy(
      pageviews.filter(e => e.referrer),
      e => {
        try {
          return new URL(e.referrer!).hostname || 'direct';
        } catch {
          return e.referrer ?? 'direct';
        }
      }
    ).slice(0, 10);

    // Devices
    const devices = countBy(pageviews, e => e.device);

    // Hourly distribution (0-23), bucketed in UTC so the chart is stable no
    // matter which timezone the server runs in.
    const hourlyMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) hourlyMap.set(h, 0);
    for (const e of pageviews) {
      const h = new Date(e.timestamp).getUTCHours();
      hourlyMap.set(h, (hourlyMap.get(h) ?? 0) + 1);
    }
    const hourlyDistribution = Array.from(hourlyMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    res.json({
      period: { days, since: since.toISOString(), timezone: 'UTC' },
      totals: {
        pageviews: pageviews.length,
        events: filtered.length,
        uniqueSessions,
      },
      dailyTrend,
      topPages,
      referrers,
      devices,
      hourlyDistribution,
      dataQuality: { malformedLines },
    });
  } catch (err) {
    console.error('analytics.summary.error', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
}