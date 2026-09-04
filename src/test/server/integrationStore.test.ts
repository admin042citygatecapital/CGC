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
      RESEND_WEBHOOK_SIGNING_SECRET: 'whsec_test_key',
      ZOHO_CLIENT_ID: 'zoho-client',
      ZOHO_CLIENT_SECRET: 'zoho-secret',
      ZOHO_REFRESH_TOKEN: 'zoho-refresh',
    })) dependencies.secrets.set(name, value);

    const { getAllIntegrations, MANAGED_INTEGRATION_IDS } = await import('../../server/lib/integrationStore.js');
    const byId = Object.fromEntries((await getAllIntegrations()).map(item => [item.id, item]));

    expect(byId.resend).toMatchObject({ name: 'Resend', status: 'connected', enabled: false });
    expect(byId.zoho_mail).toMatchObject({ status: 'connected', enabled: false });
    expect(byId.tawk).toMatchObject({ name: 'tawk.to', status: 'connected', enabled: true });
    expect(byId.tawk.secrets).toEqual([]);
    expect(byId.cloudflare).toMatchObject({ status: 'disconnected', enabled: false });
    expect(byId.banking_api).toMatchObject({ status: 'disconnected', enabled: false });
    expect(Object.keys(byId)).toEqual(MANAGED_INTEGRATION_IDS);
  });

  it('reports partial configuration when only some required secrets are present', async () => {
    dependencies.secrets.set('RESEND_API_KEY', 're_test_key');
    const { getIntegration } = await import('../../server/lib/integrationStore.js');
    await expect(getIntegration('resend')).resolves.toMatchObject({ status: 'partial' });
  });

  it('rejects undocumented fields so credentials cannot enter non-secret settings', async () => {
    const { updateIntegration } = await import('../../server/lib/integrationStore.js');
    await expect(updateIntegration('resend', { config: { apiKey: 'must-not-be-stored' } })).rejects.toThrow('INVALID_INTEGRATION_SETTINGS');
    await expect(updateIntegration('resend', { config: { fromEmail: 'noreply@citygate.capital' } })).resolves.toMatchObject({
      config: { fromEmail: 'noreply@citygate.capital' },
    });
  });

  it('persists only valid public tawk.to embed identifiers', async () => {
    const { getTawkWidgetConfig, updateIntegration } = await import('../../server/lib/integrationStore.js');
    await expect(updateIntegration('tawk', {
      config: { propertyId: 'property123', widgetId: 'widget456' },
    })).resolves.toMatchObject({ status: 'connected' });
    await expect(getTawkWidgetConfig()).resolves.toEqual({
      enabled: true,
      propertyId: 'property123',
      widgetId: 'widget456',
    });
    await expect(updateIntegration('tawk', {
      config: { propertyId: '../invalid' },
    })).rejects.toThrow('INVALID_INTEGRATION_SETTINGS');
  });
});
