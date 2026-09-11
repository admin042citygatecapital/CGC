import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  getTawkContextAttributes,
  shouldOfferBankingSupport,
} from '../../lib/tawkSupport';

describe('tawk.to integration contract', () => {
  it('uses tawk.to consistently across the public widget and administration', () => {
    const store = readFileSync('src/server/lib/integrationStore.ts', 'utf8');
    const integrationsPage = readFileSync('src/pages/admin/integrations.tsx', 'utf8');
    const chatbotPage = readFileSync('src/pages/admin/chatbot.tsx', 'utf8');
    const entry = readFileSync('src/server/entry.ts', 'utf8');

    expect(store).toContain("| 'tawk'");
    expect(store).toContain("name:        'tawk.to'");
    expect(integrationsPage).toContain('tawk:');
    expect(chatbotPage).toContain('tawk.to Support Center');
    expect(entry).toContain('/api/config/tawk-widget');
    expect(entry).not.toContain('/api/admin/smartsupp');
    expect(entry).not.toContain('/api/config/smartsupp-key');
  });

  it('does not claim that customer financial or authentication data is sent to chat', () => {
    const widget = readFileSync('src/components/TawkWidget.tsx', 'utf8');
    const context = readFileSync('src/lib/tawkSupport.ts', 'utf8');

    expect(widget).toContain('Never share passwords, authentication codes, card details, or recovery keys.');
    expect(context).toContain("support_channel: 'citygate_web'");
    expect(context).not.toMatch(/\bbalance\s*:/);
    expect(context).not.toMatch(/\baccount_number\s*:/);
  });

  it('sends only the coarse journey context — never identity attributes', () => {
    // Whatever the route or authentication state, exactly these three keys
    // may reach the third-party chat provider. Adding a name, email, KYC
    // status, country, account reference or customer identifier here would
    // silently break the support-identity policy.
    for (const [pathname, authenticated] of [
      ['/dashboard/trading/spot', true],
      ['/transfers', true],
      ['/', false],
      ['/admin/cms', true],
    ] as const) {
      const attributes = getTawkContextAttributes(pathname, authenticated);
      expect(Object.keys(attributes).sort()).toEqual(['journey', 'session_type', 'support_channel']);
      expect(attributes.support_channel).toBe('citygate_web');
      expect(attributes.session_type).toBe(authenticated ? 'authenticated' : 'guest');
    }
  });

  it('keeps the custom launcher off administration and sponsor-review routes', () => {
    expect(shouldOfferBankingSupport('/admin')).toBe(false);
    expect(shouldOfferBankingSupport('/admin/cms')).toBe(false);
    expect(shouldOfferBankingSupport('/sponsor-review')).toBe(false);
    expect(shouldOfferBankingSupport('/dashboard')).toBe(true);
    expect(shouldOfferBankingSupport('/')).toBe(true);
  });

  it('never imports identity stores into the support context module', () => {
    const context = readFileSync('src/lib/tawkSupport.ts', 'utf8');
    expect(context).not.toMatch(/useCustomerAuth|customerAuth|adminAuth|userStore|adminCredentials/);
    expect(context).not.toContain('customer.');
    expect(context).not.toContain('admin.');
  });
});
