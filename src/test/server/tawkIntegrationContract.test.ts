import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
});
