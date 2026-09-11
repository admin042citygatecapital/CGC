import type { Request } from 'express';
import fs from 'node:fs';
import type { AnalyticsEvent } from './event/POST.js';
import { privateSubdirectory } from '../../lib/storagePaths.js';

const DATA_FILE = privateSubdirectory('analytics/events.jsonl');

export interface EventFileRead {
  events: AnalyticsEvent[];
  /** Lines in events.jsonl that were not valid JSON and had to be skipped. */
  malformedLines: number;
}

/**
 * Single reader shared by the analytics report endpoints (summary, conversions,
 * ab-results). Reports how many lines could not be parsed so callers can
 * surface partial data instead of presenting a silently incomplete picture.
 */
export function readEventsFile(): EventFileRead {
  if (!fs.existsSync(DATA_FILE)) return { events: [], malformedLines: 0 };
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const events: AnalyticsEvent[] = [];
  let malformedLines = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as AnalyticsEvent);
    } catch {
      malformedLines++;
    }
  }
  return { events, malformedLines };
}

export const DEFAULT_REPORT_DAYS = 30;
export const MAX_REPORT_DAYS = 365;

/**
 * Parse the `days` query parameter. Defaults to 30; anything else must be a
 * positive integer within [1, MAX_REPORT_DAYS]. Returns null when the value is
 * present but invalid, so callers answer 400 instead of silently accepting
 * NaN, negatives or fractional windows.
 */
export function parseReportDays(req: Request): number | null {
  const raw = req.query.days;
  if (raw === undefined) return DEFAULT_REPORT_DAYS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_REPORT_DAYS) return null;
  return value;
}

/**
 * Start of the reporting window: midnight UTC on the day `days - 1` days ago.
 * Anchoring to a UTC day boundary makes the window cover exactly the calendar
 * days the daily buckets are keyed on (timestamps are ISO strings whose first
 * ten characters are the UTC date), so window totals and daily buckets always
 * agree.
 */
export function reportWindowStartUtc(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

/** UTC date key (YYYY-MM-DD) for bucketing. */
export function utcDayKey(timestamp: string): string {
  return timestamp.slice(0, 10);
}