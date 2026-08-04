import { lazy, Suspense } from 'react';
import {
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
  type RouteObject,
} from 'react-router-dom';

// NOTE (see AUDIT_REPORT.md / build-blocker fix): AiroErrorBoundary from
// '../dev-tools/src/AiroErrorBoundary' was a GoDaddy Airo dev-tooling
// component not present anywhere in this export (same missing-directory
// issue fixed in vite.config.ts). It was only ever used in development mode
// below — removed rather than reconstructed; AppErrorBoundary now covers
// both branches. If you have the real dev-tools package from your original
// Airo export, you can restore the dev-only wrapper.
import AppErrorBoundary from '@/components/AppErrorBoundary';
import CookieBannerErrorBoundary from '@/components/CookieBannerErrorBoundary';
import RootLayout from './layouts/RootLayout';
import PageSkeleton from './components/PageSkeleton';
import SmartsuppWidget from '@/components/SmartsuppWidget';
// AriaChatWidget: same missing-component situation as AiroErrorBoundary above —
// no such component, backend store, or documentation exists anywhere in this
// export, unlike SmartsuppWidget (which has a real smartsuppStore.ts backend).
// Removed rather than fabricated; restore this import if a real Aria chat
// integration is built.
import { routes } from './routes';
import { AdminAuthProvider } from './lib/adminAuth';
import { CustomerAuthProvider } from './lib/customerAuth';

const CookieBanner = lazy(() =>
  import('@/components/CookieBanner').catch((error) => {
    console.warn('Failed to load CookieBanner:', error);
    return { default: () => null };
  })
);

// Routes that manage their own full-page layout (no shared header/footer)
const STANDALONE_PREFIXES = ['/admin', '/login', '/register', '/dashboard'];

/**
 * LayoutWrapper is the persistent root element of the route tree.
 * React Router keeps it mounted for the entire SPA lifetime — only the
 * <Outlet> children swap on navigation. This makes it the ideal home for
 * SmartsuppWidget: it loads the script once, survives all navigations,
 * and has access to useLocation, useAdminAuth, and useCustomerAuth.
 */
function LayoutWrapper() {
  const location = useLocation();
  const isStandalone = STANDALONE_PREFIXES.some(
    p => location.pathname === p || location.pathname.startsWith(p + '/')
  );

  return (
    <>
      {/* Single mount point — never re-mounts during navigation */}
      <SmartsuppWidget />

      {isStandalone ? (
        <Suspense fallback={<PageSkeleton admin />}>
          <Outlet />
        </Suspense>
      ) : (
        <Suspense fallback={<PageSkeleton />}>
          <RootLayout>
            <Outlet />
          </RootLayout>
        </Suspense>
      )}
    </>
  );
}

const routeTree: RouteObject[] = [
  {
    element: <AppErrorBoundary><LayoutWrapper /></AppErrorBoundary>,
    children: routes,
  },
];

const router = createBrowserRouter(routeTree);

export default function App() {
  return (
    <AppErrorBoundary>
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <RouterProvider router={router} />
          <CookieBannerErrorBoundary>
            <Suspense fallback={null}>
              <CookieBanner />
            </Suspense>
          </CookieBannerErrorBoundary>
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </AppErrorBoundary>
  );
}
