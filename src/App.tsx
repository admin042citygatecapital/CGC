import { lazy,Suspense } from 'react';
import {
createBrowserRouter,
Outlet,
RouterProvider,
useLocation,
type RouteObject,
} from 'react-router-dom';

import AppErrorBoundary from '@/components/AppErrorBoundary';
import ClientOnly from '@/components/ClientOnly';
import CookieBannerErrorBoundary from '@/components/CookieBannerErrorBoundary';
import TawkWidget from '@/components/TawkWidget';
import AiroErrorBoundary from '../export-plugins/AiroErrorBoundary';
import PageSkeleton from './components/PageSkeleton';
import RootLayout from './layouts/RootLayout';
import { AdminAuthProvider } from './lib/adminAuth';
import { CustomerAuthProvider } from './lib/customerAuth';
import { routes } from './routes';

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
 * TawkWidget: it loads the script once, survives all navigations,
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
      <ClientOnly>
        <TawkWidget />
      </ClientOnly>

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
    element:
      import.meta.env.MODE === 'development' ? (
        <AiroErrorBoundary><AppErrorBoundary><LayoutWrapper /></AppErrorBoundary></AiroErrorBoundary>
      ) : (
        <AppErrorBoundary><LayoutWrapper /></AppErrorBoundary>
      ),
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
          <ClientOnly>
            <CookieBannerErrorBoundary>
              <Suspense fallback={null}>
                <CookieBanner />
              </Suspense>
            </CookieBannerErrorBoundary>
          </ClientOnly>
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </AppErrorBoundary>
  );
}
