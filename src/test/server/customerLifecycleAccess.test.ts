import { describe, expect, it, vi } from 'vitest';
import {
  getCustomerAccessMode,
  getCustomerLandingPath,
  isOnboardingRouteAllowed,
  requireCustomerLifecycleAccess,
} from '../../server/lib/customerLifecycleAccess';

describe('customer registration lifecycle access', () => {
  it('only grants full access after final activation', () => {
    expect(getCustomerAccessMode({ emailVerified: true, status: 'active' })).toBe('full');
    expect(getCustomerLandingPath({ emailVerified: true, status: 'active' })).toBe('/dashboard');
  });

  it.each(['pending_kyc', 'pending_approval'] as const)('keeps %s customers in onboarding-only access', (status) => {
    expect(getCustomerAccessMode({ emailVerified: true, status })).toBe('onboarding');
    expect(getCustomerLandingPath({ emailVerified: true, status })).toBe('/kyc');
  });

  it.each(['pending_verification', 'suspended', 'frozen', 'rejected'] as const)('denies %s customers', (status) => {
    expect(getCustomerAccessMode({ emailVerified: status !== 'pending_verification', status })).toBe('denied');
  });

  it('allows only the narrow registration endpoints during onboarding', () => {
    expect(isOnboardingRouteAllowed('GET', '/session')).toBe(true);
    expect(isOnboardingRouteAllowed('GET', '/onboarding')).toBe(true);
    expect(isOnboardingRouteAllowed('PUT', '/onboarding/profile')).toBe(true);
    expect(isOnboardingRouteAllowed('POST', '/onboarding/documents')).toBe(true);
    expect(isOnboardingRouteAllowed('POST', '/onboarding/submit')).toBe(true);
    expect(isOnboardingRouteAllowed('POST', '/kyc-document')).toBe(false);
    expect(isOnboardingRouteAllowed('POST', '/logout')).toBe(true);
    expect(isOnboardingRouteAllowed('GET', '/balance')).toBe(false);
    expect(isOnboardingRouteAllowed('GET', '/transactions')).toBe(false);
    expect(isOnboardingRouteAllowed('POST', '/transfer')).toBe(false);
    expect(isOnboardingRouteAllowed('GET', '/wallet-overview')).toBe(false);
    expect(isOnboardingRouteAllowed('GET', '/support')).toBe(true);
    expect(isOnboardingRouteAllowed('POST', '/support')).toBe(true);
  });

  it('does not classify identity-document upload as a public customer route', async () => {
    const { classifyRouteAuth } = await import('../../server/lib/developerRouteInventory');
    expect(classifyRouteAuth('/api/users/kyc-document')).toBe('customer');
  });

  it('returns a server-side 403 for dashboard APIs used by a restricted session', () => {
    const next = vi.fn();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    requireCustomerLifecycleAccess({
      method: 'GET',
      path: '/balance',
      customerUser: { emailVerified: true, status: 'pending_kyc' },
    } as never, { status } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ONBOARDING_ONLY', nextPath: '/kyc' }));
  });
});
