import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
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
  /** Free-form metadata — e.g. { plan: 'premium', amount: 500, currency: 'USD' } */
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

export default function handler(req: Request, res: Response) {
  try {
    const { type = 'pageview', page, referrer, sessionId, meta } = req.body as Partial<AnalyticsEvent>;

    if (!page || typeof page !== 'string') {
      return res.status(400).json({ error: 'page is required' });
    }

    const rawType = String(type);
    const safeType: EventType = ALL_TYPES.has(rawType) ? (rawType as EventType) : 'custom';

    const ua = req.headers['user-agent'] ?? '';
    const event: AnalyticsEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: safeType,
      page: page.slice(0, 200),
      referrer: referrer ? String(referrer).slice(0, 500) : undefined,
      sessionId: sessionId ? String(sessionId).slice(0, 64) : undefined,
      meta: meta && typeof meta === 'object' ? meta : undefined,
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
