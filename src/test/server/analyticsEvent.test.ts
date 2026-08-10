import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let privateRoot = '';
let handler: (req: Request, res: Response) => unknown;

beforeAll(async () => {
  privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-analytics-'));
  process.env.PRIVATE_DATA_ROOT = privateRoot;
  vi.resetModules();
  handler = (await import('../../server/api/analytics/event/POST.js')).default;
});

afterAll(() => {
  fs.rmSync(privateRoot, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
});

function invoke(body: unknown, consent?: string) {
  const result: { status: number; body?: unknown } = { status: 200 };
  const req = {
    body,
    headers: { 'user-agent': 'Mozilla/5.0 (iPhone; Mobile)' },
    get(name: string) {
      return name.toLowerCase() === 'x-cgc-analytics-consent' ? consent : undefined;
    },
  } as unknown as Request;
  const res = {
    status(code: number) { result.status = code; return res; },
    json(value: unknown) { result.body = value; return res; },
  } as unknown as Response;
  handler(req, res);
  return result;
}

describe('public analytics event intake', () => {
  it('rejects events without an explicit consent signal', () => {
    expect(invoke({ page: '/' }).status).toBe(403);
    expect(fs.existsSync(path.join(privateRoot, 'analytics', 'events.jsonl'))).toBe(false);
  });

  it('stores only data-minimised, allowlisted event fields', () => {
    const result = invoke({
      type: 'plan_selected',
      page: '/accounts?token=secret#private',
      referrer: 'https://referrer.example/path?email=person@example.test',
      sessionId: '1234567890-abc_def',
      meta: {
        plan: 'premium',
        currency: 'GBP',
        amount: 500,
        email: 'person@example.test',
        password: 'should-never-be-stored',
      },
    }, 'granted');

    expect(result.status).toBe(201);
    const record = JSON.parse(fs.readFileSync(path.join(privateRoot, 'analytics', 'events.jsonl'), 'utf8').trim());
    expect(record).toMatchObject({
      type: 'plan_selected',
      page: '/accounts',
      referrer: 'https://referrer.example',
      sessionId: '1234567890-abc_def',
      device: 'mobile',
      meta: { plan: 'premium', currency: 'GBP' },
    });
    expect(JSON.stringify(record)).not.toContain('secret');
    expect(JSON.stringify(record)).not.toContain('person@example.test');
    expect(record.meta).not.toHaveProperty('amount');
    expect(record.meta).not.toHaveProperty('password');
  });

  it('rejects absolute and protocol-relative page values', () => {
    expect(invoke({ page: 'https://evil.example/path' }, 'granted').status).toBe(400);
    expect(invoke({ page: '//evil.example/path' }, 'granted').status).toBe(400);
  });
});
