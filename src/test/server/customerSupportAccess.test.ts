import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_SUPPORT_CATEGORIES,
  ONBOARDING_SUPPORT_CATEGORIES,
  getCustomerSupportSurface,
} from '../../lib/customerSupportAccess.js';

describe('customer support surface', () => {
  it('limits a restricted onboarding session to identity, access, and technical support', () => {
    const surface = getCustomerSupportSurface('/onboarding/support');
    expect(surface.onboarding).toBe(true);
    expect(surface.categories).toEqual(ONBOARDING_SUPPORT_CATEGORIES);
    expect(surface.categories).not.toContain('Transfer Workspace');
    expect(surface.categories).not.toContain('Card Workspace');
    expect(surface.categories).not.toContain('Trading Workspace');
    expect(surface.backHref).toBe('/kyc');
    expect(surface.defaultCategory).toBe('Identity Verification');
  });

  it('preserves the complete support surface for an active customer', () => {
    const surface = getCustomerSupportSurface('/dashboard/support');
    expect(surface.onboarding).toBe(false);
    expect(surface.categories).toEqual(CUSTOMER_SUPPORT_CATEGORIES);
    expect(surface.backHref).toBe('/dashboard');
    expect(surface.defaultCategory).toBe('General');
  });
});
