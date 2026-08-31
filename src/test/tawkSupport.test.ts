import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  getSupportSection,
  getTawkContextAttributes,
  shouldOfferBankingSupport,
} from '../lib/tawkSupport';

describe('product support widget routing', () => {
  it('keeps the customer support widget out of administration pages', () => {
    expect(shouldOfferBankingSupport('/')).toBe(true);
    expect(shouldOfferBankingSupport('/dashboard')).toBe(true);
    expect(shouldOfferBankingSupport('/admin')).toBe(false);
    expect(shouldOfferBankingSupport('/admin/users')).toBe(false);
  });

  it('classifies customer and demo journeys', () => {
    expect(getSupportSection('/login')).toBe('authentication');
    expect(getSupportSection('/dashboard/transfers')).toBe('customer_dashboard');
    expect(getSupportSection('/dashboard/trading/orders')).toBe('trading');
    expect(getSupportSection('/accounts')).toBe('account_options');
    expect(getSupportSection('/demo/accounts')).toBe('account_options');
    expect(getSupportSection('/demo/support')).toBe('demo_support');
  });

  it('uses non-PII routing attributes', () => {
    expect(getTawkContextAttributes('/dashboard', true)).toEqual({
      support_channel: 'citygate_web',
      journey: 'customer_dashboard',
      session_type: 'authenticated',
    });
  });

  it('presents the support launcher as a branded circular bank seal', () => {
    const source = readFileSync('src/components/TawkWidget.tsx', 'utf8');

    expect(source).toContain('h-20 w-20');
    expect(source).toContain('rounded-full');
    expect(source).toContain('/assets/brand/city-gate-capital-seal.png');
    expect(source).toContain('Chat with City Gate Capital support');
    expect(source).toContain('Never share passwords, authentication codes, card details, or recovery keys.');
    expect(source).not.toContain('MessageCircle');
  });
});
