import { describe, expect, it } from 'vitest';

import {
  getSupportSection,
  getTawkContextAttributes,
  shouldOfferBankingSupport,
} from '../lib/tawkSupport';

describe('banking support widget routing', () => {
  it('keeps the customer support widget out of administration pages', () => {
    expect(shouldOfferBankingSupport('/')).toBe(true);
    expect(shouldOfferBankingSupport('/dashboard')).toBe(true);
    expect(shouldOfferBankingSupport('/admin')).toBe(false);
    expect(shouldOfferBankingSupport('/admin/users')).toBe(false);
  });

  it('classifies high-value banking journeys', () => {
    expect(getSupportSection('/login')).toBe('authentication');
    expect(getSupportSection('/dashboard/transfers')).toBe('customer_dashboard');
    expect(getSupportSection('/dashboard/trading/orders')).toBe('trading');
    expect(getSupportSection('/accounts')).toBe('accounts');
  });

  it('uses non-PII routing attributes', () => {
    expect(getTawkContextAttributes('/dashboard', true)).toEqual({
      support_channel: 'citygate_web',
      journey: 'customer_dashboard',
      session_type: 'authenticated',
    });
  });
});
