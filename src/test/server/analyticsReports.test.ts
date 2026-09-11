import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let privateRoot = '';
let summaryHandler: (req: Request, res: Response) => unknown;
let conversionsHandler: (req: Request, res: Response) => unknown;
let abResultsHandler: (req: Request, res: Response) => unknown;

beforeAll(async () => {
  privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-analytics-reports-'));
  process.env.PRIVATE_DATA_ROOT = privateRoot;
  vi.resetModules();
  summaryHandler = (await import('../../server/api/analytics/summary/GET.js')).default;
  conversionsHandler = (await import('../../server/api/analytics/conversions/GET.js')).default;
  abResultsHandler = (await import('../../server/api/analytics/ab-results/GET.js')).default;
});

afterAll(() => {
  fs.rmSync(privateRoot, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
});

function invoke(handler: (req: Request, res: Response) => unknown, query: Record<string, string> = {}) {
  const result: { status: number; body?: unknown } = { status: 200 };
  const req = { query, headers: {} } as unknown as Request;
  const res = {
    status(code: number) { result.status = code; return res; },
    json(value: unknown) { result.body = value; return res; },
  } as unknown as Response;
  handler(req, res);
  return result;
}

function seedEventsFile(lines: unknown[]) {
  const dir = path.join(privateRoot, 'analytics');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'events.jsonl'),
    lines.map(line => JSON.stringify(line)).join('\n') + '\n{this line is not json}\n',
    'utf8',
  );
}

function event(overrides: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    type: 'pageview',
    page: '/',
    sessionId: 'session-0000001',
    timestamp: new Date().toISOString(),
    device: 'desktop',
    ...overrides,
  };
}

describe('analytics report endpoints', () => {
  it('rejects invalid days values with 400 across all report endpoints', () => {
    for (const days of ['0', '-5', '400', '1.5', 'abc', '']) {
      expect(invoke(summaryHandler, { days }).status).toBe(400);
      expect(invoke(conversionsHandler, { days }).status).toBe(400);
      expect(invoke(abResultsHandler, { days }).status).toBe(400);
    }
    expect(invoke(summaryHandler).status).toBe(200); // default 30
    expect(invoke(summaryHandler, { days: '365' }).status).toBe(200);
  });

  it('keys daily buckets on UTC calendar days matching the window', () => {
    seedEventsFile([
      event({ type: 'pageview', page: '/', sessionId: 'session-0000001' }),
      event({ type: 'pageview', page: '/', sessionId: 'session-0000002' }),
    ]);

    const result = invoke(summaryHandler, { days: '7' });
    expect(result.status).toBe(200);
    const body = result.body as {
      period: { days: number; since: string; timezone: string };
      dailyTrend: { date: string; count: number }[];
      totals: { pageviews: number };
      dataQuality: { malformedLines: number };
    };

    expect(body.period).toEqual({ days: 7, since: expect.any(String), timezone: 'UTC' });
    expect(body.dailyTrend).toHaveLength(7);
    // Window total and bucket total must agree.
    expect(body.dailyTrend.reduce((sum, point) => sum + point.count, 0)).toBe(body.totals.pageviews);
    expect(body.dataQuality).toEqual({ malformedLines: 1 });
  });

  it('buckets hourly distribution in UTC', () => {
    const at14Utc = new Date();
    at14Utc.setUTCHours(14, 0, 0, 0);
    seedEventsFile([event({ type: 'pageview', page: '/', sessionId: 'session-0000001', timestamp: at14Utc.toISOString() })]);

    const body = invoke(summaryHandler).body as { hourlyDistribution: { hour: number; count: number }[] };
    expect(body.hourlyDistribution.find(h => h.hour === 14)?.count).toBe(1);
    expect(body.hourlyDistribution.reduce((sum, point) => sum + point.count, 0)).toBe(1);
  });

  it('reports funnel as independent event counts and a signup-start rate label', () => {
    seedEventsFile([
      event({ type: 'pageview', page: '/', sessionId: 'session-0000001' }),
      event({ type: 'signup_started', page: '/accounts', sessionId: 'session-0000001' }),
      event({ type: 'plan_selected', page: '/accounts', sessionId: 'session-0000001', meta: { plan: 'premium' } }),
    ]);

    const body = invoke(conversionsHandler, { days: '7' }).body as {
      totals: { signupStartRate: string; pageviews: number; conversions: number };
      funnel: { step: string; count: number }[];
      planBreakdown: { plan: string; count: number }[];
    };

    expect(body.totals.signupStartRate).toBe('100.00%');
    expect(body.funnel.find(step => step.step === 'Page Views')?.count).toBe(1);
    expect(body.funnel.find(step => step.step === 'Signup Started')?.count).toBe(1);
    expect(body.planBreakdown).toEqual([{ plan: 'premium', count: 1 }]);
  });

  it('keeps attacker-controlled plan names out of object internals', () => {
    seedEventsFile([
      event({ type: 'plan_selected', page: '/accounts', sessionId: 'session-0000001', meta: { plan: '__proto__' } }),
      event({ type: 'plan_selected', page: '/accounts', sessionId: 'session-0000002', meta: { plan: 'constructor' } }),
    ]);

    const body = invoke(conversionsHandler, { days: '7' }).body as { planBreakdown: { plan: string; count: number }[] };
    const plans = body.planBreakdown.map(entry => entry.plan).sort();
    expect(plans).toEqual(['__proto__', 'constructor']);
  });

  it('crows no winner on ties or single eligible variants', () => {
    const now = new Date().toISOString();
    seedEventsFile([
      event({ type: 'ab_impression', sessionId: 'session-0000001', meta: { experiment: 'cta-color', variant: 'control' }, timestamp: now }),
      event({ type: 'ab_impression', sessionId: 'session-0000002', meta: { experiment: 'cta-color', variant: 'gold' }, timestamp: now }),
      // 60 impressions each, identical conversion counts → tied rates
      ...Array.from({ length: 60 }, (_, i) =>
        event({ type: 'ab_impression', sessionId: `session-tie-a${i}`, meta: { experiment: 'cta-color', variant: 'control' }, timestamp: now })),
      ...Array.from({ length: 60 }, (_, i) =>
        event({ type: 'ab_impression', sessionId: `session-tie-b${i}`, meta: { experiment: 'cta-color', variant: 'gold' }, timestamp: now })),
      event({ type: 'ab_conversion', sessionId: 'session-0000001', meta: { experiment: 'cta-color', variant: 'control' }, timestamp: now }),
      event({ type: 'ab_conversion', sessionId: 'session-0000002', meta: { experiment: 'cta-color', variant: 'gold' }, timestamp: now }),
    ]);

    const body = invoke(abResultsHandler, { days: '7' }).body as {
      experiments: { experimentId: string; variants: { variant: string; impressions: number; sampleTier: string }[]; winner: string | null }[];
    };

    const experiment = body.experiments.find(e => e.experimentId === 'cta-color');
    expect(experiment).toBeDefined();
    expect(experiment!.winner).toBeNull(); // tied rates → no leader
    for (const variant of experiment!.variants) {
      expect(variant.impressions).toBe(61); // 1 seed + 60 tie impressions
      expect(variant.sampleTier).toBe('medium');
    }
  });

  it('crows a winner when one eligible variant clearly leads', () => {
    const now = new Date().toISOString();
    const lines: unknown[] = [];
    for (let i = 0; i < 60; i++) {
      lines.push(event({ type: 'ab_impression', sessionId: `session-ctl-${i}`, meta: { experiment: 'hero-copy', variant: 'control' }, timestamp: now }));
      lines.push(event({ type: 'ab_impression', sessionId: `session-var-${i}`, meta: { experiment: 'hero-copy', variant: 'variant-b' }, timestamp: now }));
    }
    lines.push(event({ type: 'ab_conversion', sessionId: 'session-ctl-0', meta: { experiment: 'hero-copy', variant: 'control' }, timestamp: now }));
    for (let i = 0; i < 6; i++) {
      lines.push(event({ type: 'ab_conversion', sessionId: `session-var-${i}`, meta: { experiment: 'hero-copy', variant: 'variant-b' }, timestamp: now }));
    }
    seedEventsFile(lines);

    const body = invoke(abResultsHandler, { days: '7' }).body as {
      experiments: { experimentId: string; winner: string | null }[];
    };
    expect(body.experiments.find(e => e.experimentId === 'hero-copy')?.winner).toBe('variant-b');
  });
});