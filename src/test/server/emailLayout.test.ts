import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/lib/emailBrandingStore.js', () => ({
  loadEmailBranding: () => ({
    brandName: 'City Gate Capital',
    logoUrl: 'https://citygate.capital/assets/brand/city-gate-capital-horizontal.png',
    websiteUrl: 'https://citygate.capital',
    websiteButtonLabel: 'Open City Gate Capital',
    supportEmail: 'support@citygate.capital',
    supportPhone: '+44 7888 382458',
    postalAddress: '1 Canada Square, London',
    primaryColor: '#C9A84C',
    footerMessage: 'Secure access to your account.',
    updatedAt: '2026-08-08T00:00:00.000Z',
    updatedBy: 'test',
  }),
}));

import { escapeEmailHtml, renderBrandedEmail } from '../../server/lib/emailLayout.js';

describe('renderBrandedEmail', () => {
  it('renders the new logo and clickable banking website in every message', () => {
    const html = renderBrandedEmail({ title: 'Account update', bodyHtml: '<p>Your account was updated.</p>' });

    expect(html).toContain('https://citygate.capital/assets/brand/city-gate-capital-horizontal.png');
    expect(html).toContain('href="https://citygate.capital"');
    expect(html).toContain('Open City Gate Capital');
    expect(html).toContain('support@citygate.capital');
    expect(html).toContain('Secure access to your account.');
  });

  it('escapes untrusted values used by templates', () => {
    expect(escapeEmailHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });
});

