import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({ secrets: new Map<string, string>() }));
vi.mock('#runtime/secrets', () => ({
  getSecret: (name: string) => dependencies.secrets.get(name),
}));

let root = '';

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-integrations-'));
  process.env.PRIVATE_DATA_ROOT = root;
  dependencies.secrets.clear();
  vi.resetModules();
});

afterEach(() => {
  delete process.env.PRIVATE_DATA_ROOT;
  fs.rmSync(root, { recursive: true, force: true });
});

describe('integration status reporting', () => {
  it('reports configured services independently from their optional enable switch', async () => {
    for (const [name, value] of Object.entries({
      RESEND_API_KEY: 're_test_key',
      RESEND_WEBHOOK_SECRET: 'whsec_test_key',
      ZOHO_CLIENT_ID: 'zoho-client',
      ZOHO_CLIENT_SECRET: 'zoho-secret',
      ZOHO_REFRESH_TOKEN: 'zoho-refresh',
      CLOUDFLARE_API_TOKEN: 'cf-token',
      CLOUDFLARE_ZONE_ID: 'cf-zone',
    })) dependencies.secrets.set(name, value);

    const { getAllIntegrations } = await import('../../server/lib/integrationStore.js');
    const byId = Object.fromEntries(getAllIntegrations().map(item => [item.id, item]));

    expect(byId.resend).toMatchObject({ name: 'Resend', status: 'connected', enabled: false });
    expect(byId.zoho_mail).toMatchObject({ status: 'connected', enabled: false });
    expect(byId.cloudflare).toMatchObject({ status: 'connected', enabled: false });
    expect(byId.smartsupp.status).toBe('disconnected');
    expect(byId.banking_api.status).toBe('disconnected');
  });

  it('reports partial configuration when only some required secrets are present', async () => {
    dependencies.secrets.set('RESEND_API_KEY', 're_test_key');
    const { getIntegration } = await import('../../server/lib/integrationStore.js');
    expect(getIntegration('resend')).toMatchObject({ status: 'partial' });
  });
});
