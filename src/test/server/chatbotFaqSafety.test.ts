import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let root = '';

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-chatbot-faq-'));
  process.env.PRIVATE_DATA_ROOT = root;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
});

function response() {
  const state: { status: number; body?: any } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return res; },
    json(body: unknown) { state.body = body; return res; },
  } as unknown as Response;
  return { res, state };
}

describe('chatbot FAQ safety', () => {
  it('seeds only preview-safe answers and does not overwrite data for an empty filter', async () => {
    const store = await import('../../server/lib/smartsuppStore.js');
    const seeded = store.getFaq();

    expect(seeded).toHaveLength(5);
    expect(seeded.map(entry => entry.answer).join(' ')).not.toMatch(/typically settle|10,000\/day|tap "Freeze"/i);
    expect(store.getFaq({ category: 'Does not exist' })).toEqual([]);
    expect(store.getFaq()).toHaveLength(5);
  });

  it('migrates persisted legacy financial answers on read', async () => {
    const chatbotDir = path.join(root, 'chatbot');
    fs.mkdirSync(chatbotDir, { recursive: true });
    const legacy = {
      id: 'legacy-transfer',
      question: 'How do I transfer money internationally?',
      answer: 'Transfers typically settle in 1–3 business days.',
      category: 'Transfers',
      enabled: true,
      triggerKeywords: ['transfer'],
      viewCount: 3,
      helpfulCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    fs.writeFileSync(path.join(chatbotDir, 'faq.jsonl'), `${JSON.stringify(legacy)}\n`, 'utf8');

    const store = await import('../../server/lib/smartsuppStore.js');
    const [migrated] = store.getFaq();
    expect(migrated.id).toBe('legacy-transfer');
    expect(migrated.answer).toContain('not available in this product preview');
    expect(migrated.answer).not.toMatch(/typically settle/i);
    expect(fs.readFileSync(path.join(chatbotDir, 'faq.jsonl'), 'utf8')).not.toMatch(/typically settle/i);
  });

  it('runs the FAQ safety migration during server initialisation', async () => {
    const chatbotDir = path.join(root, 'chatbot');
    const legacy = {
      id: 'legacy-card',
      question: 'How do I freeze my card?',
      answer: 'Go to Dashboard → Cards → select your card → tap "Freeze".',
      category: 'Cards', enabled: true, triggerKeywords: ['freeze card'],
      viewCount: 0, helpfulCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    fs.writeFileSync(path.join(chatbotDir, 'faq.jsonl'), `${JSON.stringify(legacy)}\n`, 'utf8');

    const store = await import('../../server/lib/smartsuppStore.js');
    expect(store.initializeFaqSafety()).toBe(1);
    expect(fs.readFileSync(path.join(chatbotDir, 'faq.jsonl'), 'utf8')).toContain('No payment card is issued');
  });

  it('rejects unsafe answers through the administration endpoint', async () => {
    const handler = (await import('../../server/api/admin/smartsupp/faq/POST.js')).default;
    const result = response();
    handler({
      body: {
        action: 'upsert',
        question: 'What are the limits?',
        answer: 'Standard accounts: £10,000/day.',
        category: 'Limits',
      },
    } as unknown as Request, result.res);

    expect(result.state.status).toBe(400);
    expect(result.state.body).toMatchObject({ code: 'UNSUPPORTED_FINANCIAL_CLAIM' });
  });

  it('labels the FAQ response as preview support content', async () => {
    const handler = (await import('../../server/api/admin/smartsupp/faq/GET.js')).default;
    const result = response();
    handler({ query: {} } as unknown as Request, result.res);
    expect(result.state.status).toBe(200);
    expect(result.state.body.dataClassification).toBe('preview_support_knowledge_base');
  });
});
