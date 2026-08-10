import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { privateSubdirectory } from '../../../lib/storagePaths.js';

const DATA_DIR = privateSubdirectory('analytics');
const DATA_FILE = path.join(DATA_DIR, 'events.jsonl');

/** All event types tracked across the site */
export type EventType =
  | 'pageview'
  | 'click'
  | 'custom'
  // Conversion funnel events
  | 'signup_started'       // User clicks any "Open Account" / "Get Started" CTA
  | 'signup_completed'     // User completes the signup / KYC flow
  | 'account_open'         // Account successfully opened (confirmation step)
  | 'transfer_initiated'   // User clicks "Send Money" / initiates a transfer
  | 'plan_selected'        // User selects a pricing plan
  // A/B testing events
  | 'ab_impression'        // User was shown a variant
  | 'ab_conversion';       // User converted on a variant

/** Conversion event types — used to filter funnel data */
export const CONVERSION_TYPES: EventType[] = [
  'signup_started',
  'signup_completed',
  'account_open',
  'transfer_initiated',
  'plan_selected',
];

/** A/B event types */
export const AB_TYPES: EventType[] = ['ab_impression', 'ab_conversion'];

export interface AnalyticsEvent {
  id: string;
  type: EventType;
  page: string;
  referrer?: string;
  sessionId?: string;
  /** Allowlisted, data-minimised metadata only. */
  meta?: Record<string, string | number | boolean>;
  timestamp: string;
  /** Derived from User-Agent — no PII stored */
  device: 'mobile' | 'tablet' | 'desktop';
}

const ALL_TYPES = new Set<string>([
  'pageview', 'click', 'custom',
  'signup_started', 'signup_completed', 'account_open',
  'transfer_initiated', 'plan_selected',
  'ab_impression', 'ab_conversion',
]);

const ALLOWED_META_KEYS = new Set([
  'source', 'plan', 'billing', 'currency', 'corridor',
  'experiment', 'variant', 'ab_variant', 'label', 'target',
]);

function detectDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sanitizePage(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1_000) return null;
  const hasControlCharacter = [...value].some(character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (!value.startsWith('/') || value.startsWith('//') || hasControlCharacter) return null;
  const pathname = value.split(/[?#]/, 1)[0].slice(0, 200);
  return pathname || '/';
}

function sanitizeReferrer(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2_000) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin.slice(0, 200) : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeSessionId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) return undefined;
  return value;
}

function sanitizeMeta(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!ALLOWED_META_KEYS.has(key)) continue;
    if (typeof item === 'string') safe[key] = item.slice(0, 80);
    else if (typeof item === 'boolean') safe[key] = item;
    else if (typeof item === 'number' && Number.isFinite(item)) safe[key] = item;
  }
  return Object.keys(safe).length ? safe : undefined;
}

export default function handler(req: Request, res: Response) {
  try {
    if (req.get('X-CGC-Analytics-Consent') !== 'granted') {
      return res.status(403).json({ error: 'Analytics consent required' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Invalid event payload' });
    }

    const { type = 'pageview', page, referrer, sessionId, meta } = req.body as Partial<AnalyticsEvent>;
    const safePage = sanitizePage(page);

    if (!safePage) {
      return res.status(400).json({ error: 'page must be a relative path' });
    }

    const rawType = String(type);
    const safeType: EventType = ALL_TYPES.has(rawType) ? (rawType as EventType) : 'custom';

    const ua = req.headers['user-agent'] ?? '';
    const event: AnalyticsEvent = {
      id: randomUUID(),
      type: safeType,
      page: safePage,
      referrer: sanitizeReferrer(referrer),
      sessionId: sanitizeSessionId(sessionId),
      meta: sanitizeMeta(meta),
      timestamp: new Date().toISOString(),
      device: detectDevice(ua),
    };

    ensureDir();
    fs.appendFileSync(DATA_FILE, JSON.stringify(event) + '\n', 'utf8');

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('analytics.event.error', err);
    return res.status(500).json({ error: 'Failed to record event' });
  }
}
