import type { HelmetServerState } from '@dr.pogodin/react-helmet';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { StrictMode,Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import {
Outlet,
StaticRouterProvider,
createStaticHandler,
createStaticRouter,
useLocation,
type RouteObject,
} from 'react-router-dom';

import PageSkeleton from './components/PageSkeleton';
import PreviewBanner from './components/PreviewBanner';
import RootLayout from './layouts/RootLayout';
import { AdminAuthProvider } from './lib/adminAuth';
import { routes } from './routes';

export interface RenderResult {
  html: string;
  head: string;
  status: number;
  redirect?: string;
}

function SSRLayoutWrapper() {
  const location = useLocation();
  const standalonePrefixes = ['/admin', '/login', '/register', '/dashboard'];
  const isStandalone = standalonePrefixes.some(
    prefix => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );
  if (isStandalone) {
    return (
      <>
        <PreviewBanner />
        <Suspense fallback={<PageSkeleton admin />}>
          <Outlet />
        </Suspense>
      </>
    );
  }
  return (
    <>
      <PreviewBanner />
      <Suspense fallback={<PageSkeleton />}>
        <RootLayout>
          <Outlet />
        </RootLayout>
      </Suspense>
    </>
  );
}

const routeTree: RouteObject[] = [
  {
    element: <SSRLayoutWrapper />,
    children: routes,
  },
];

const handler = createStaticHandler(routeTree);

export async function render(url: string): Promise<RenderResult> {
  const context = await handler.query(new Request(`http://ssr${url}`));

  if (context instanceof Response) {
    return {
      html: '',
      head: '',
      status: context.status,
      redirect: context.headers.get('Location') ?? undefined,
    };
  }

  const router = createStaticRouter(routeTree, context);
  const helmetContext: { helmet?: HelmetServerState } = {};
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });

  const html = renderToString(
    <StrictMode>
      <HelmetProvider context={helmetContext}>
        <QueryClientProvider client={queryClient}>
          <AdminAuthProvider>
            <StaticRouterProvider router={router} context={context} />
          </AdminAuthProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </StrictMode>
  );

  const h = helmetContext.helmet;
  const head = h
    ? [
        h.title?.toString() ?? '',
        h.meta?.toString() ?? '',
        h.link?.toString() ?? '',
        h.script?.toString() ?? '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return { html, head, status: context.statusCode ?? 200 };
}
