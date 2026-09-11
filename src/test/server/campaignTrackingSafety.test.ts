import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let root = '';

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-campaign-tracking-'));
  process.env.PRIVATE_DATA_ROOT = root;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
});

function response() {
  const state: { status: number; body?: Record<string, unknown> } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return res; },
    json(body: unknown) { state.body = body as Record<string, unknown>; return res; },
  } as unknown as Response;
  return { res, state };
}

describe('newsletter campaign tracking classification', () => {
  it('creates campaigns without invented engagement measurements', async () => {
    const store = await import('../../server/lib/campaignStore.js');
    const campaign = await store.createCampaign({
      name: 'Preview update',
      subject: 'Product update',
      body: '<p>Update</p>',
      segment: { group: 'all' },
    });

    expect(campaign.stats).toMatchObject({
      openRate: null,
      clickRate: null,
      engagementTracking: 'not_configured',
    });
  });

  it('neutralises legacy open and click percentages when no tracker exists', async () => {
    const newsletterDir = path.join(root, 'newsletter');
    fs.mkdirSync(newsletterDir, { recursive: true });
    const legacy = {
      id: 'legacy-campaign', name: 'Legacy', subject: 'Legacy', body: '<p>Legacy</p>',
      segment: { group: 'all' }, status: 'sent', createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z', createdBy: 'admin',
      stats: { totalRecipients: 10, sent: 10, failed: 0, openRate: 75, clickRate: 50, unsubscribes: 0 },
    };
    fs.writeFileSync(path.join(newsletterDir, 'campaigns.json'), JSON.stringify([legacy]), 'utf8');

    const store = await import('../../server/lib/campaignStore.js');
    expect((await store.listCampaigns())[0].stats).toMatchObject({
      openRate: null,
      clickRate: null,
      engagementTracking: 'not_configured',
    });
  });

  it('labels campaign API data as delivery records without engagement tracking', async () => {
    const handler = (await import('../../server/api/admin/newsletter/campaigns/GET.js')).default;
    const result = response();
    await handler({} as Request, result.res);
    expect(result.state.status).toBe(200);
    expect(result.state.body?.dataClassification).toBe('email_delivery_records_without_engagement_tracking');
  });
});
