import type { Request, Response } from 'express';
import fs from 'node:fs';
import type { AnalyticsEvent } from '../event/POST.js';

const DATA_FILE = '/private/analytics/events.jsonl';

function readEvents(): AnalyticsEvent[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const events: AnalyticsEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as AnalyticsEvent);
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

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
    const days = Math.min(Number(req.query.days ?? 30), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const all = readEvents();
    const filtered = all.filter(e => new Date(e.timestamp) >= since);
    const pageviews = filtered.filter(e => e.type === 'pageview');

    // Daily pageview trend (last N days)
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000);
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const e of pageviews) {
      const day = e.timestamp.slice(0, 10);
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

    // Hourly distribution (0-23)
    const hourlyMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) hourlyMap.set(h, 0);
    for (const e of pageviews) {
      const h = new Date(e.timestamp).getHours();
      hourlyMap.set(h, (hourlyMap.get(h) ?? 0) + 1);
    }
    const hourlyDistribution = Array.from(hourlyMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    res.json({ ok: true, period: { days, since: since.toISOString() },
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
    });
  } catch (err) {
    console.error('analytics.summary.error', err);
    res.status(500).json({ ok: false, error: 'Failed to load analytics' });
  }
}
