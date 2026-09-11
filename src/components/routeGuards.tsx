/**
 * Route boundary guards, split out of routes.tsx so that file exports only
 * the routes table (react-refresh/only-export-components).
 */
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/lib/adminAuth';
import { useCustomerAuth } from '@/lib/customerAuth';
import { usePlatformFeature } from '@/lib/platformFeatures';
import type { PlatformFeatureKey } from '@/shared/platformFeatures';
import SandboxScopePage from '@/components/SandboxScopePage';
import FeatureUnavailable from '@/components/FeatureUnavailable';
import CustomerMobileNav from '@/components/CustomerMobileNav';
import { useClientHydrated } from '@/lib/useClientHydrated';
import { isOutsideSandboxKycScope } from '@/shared/productScope';

/** Redirect to /admin/login if not authenticated as admin */
export function AdminOnly({ children }: { children: ReactNode }) {
  const hydrated = useClientHydrated();
  const { admin, loading } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !admin) navigate('/admin/login', { replace: true });
  }, [admin, loading, navigate]);
  if (!hydrated || loading || !admin) return null;
  if (isOutsideSandboxKycScope(location.pathname)) return <SandboxScopePage />;
  return <>{children}</>;
}

/** Redirect to /login if not authenticated as customer */
export function CustomerOnly({ children }: { children: ReactNode }) {
  const hydrated = useClientHydrated();
  const { customer, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onboardingRoute = location.pathname === '/kyc' || location.pathname === '/onboarding' || location.pathname === '/onboarding/support';
  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
    else if (!loading && customer?.accessMode === 'onboarding' && !onboardingRoute) navigate('/kyc', { replace: true });
  }, [customer, loading, navigate, onboardingRoute]);
  if (!hydrated || loading || !customer) return null;
  if (customer.accessMode === 'onboarding' && !onboardingRoute) return null;
  if (isOutsideSandboxKycScope(location.pathname)) return <SandboxScopePage />;
  return <>
    <div className={customer.accessMode === 'full' ? 'pb-16 md:pb-0' : undefined}>{children}</div>
    {customer.accessMode === 'full' && <CustomerMobileNav />}
  </>;
}

export function FeatureOnly({ feature, children }: { feature: PlatformFeatureKey; children: ReactNode }) {
  return usePlatformFeature(feature) ? <>{children}</> : <FeatureUnavailable />;
}