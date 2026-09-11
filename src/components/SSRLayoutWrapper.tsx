/**
 * SSR-only layout wrapper, split out of entry-server.tsx so that file exports
 * only the render function (react-refresh/only-export-components).
 */
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import PageSkeleton from '@/components/PageSkeleton';
import RootLayout from '@/layouts/RootLayout';

export function SSRLayoutWrapper() {
  const location = useLocation();
  // Must stay in sync with STANDALONE_PREFIXES in App.tsx — SSR and the
  // client agree on which routes render without the shared RootLayout chrome.
  const standalonePrefixes = ['/admin', '/login', '/register', '/dashboard', '/plaid', '/sponsor-review'];
  const isStandalone = standalonePrefixes.some(
    prefix => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );
  if (isStandalone) {
    return (
      <>
        <Suspense fallback={<PageSkeleton admin />}>
          <Outlet />
        </Suspense>
      </>
    );
  }
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <RootLayout>
          <Outlet />
        </RootLayout>
      </Suspense>
    </>
  );
}