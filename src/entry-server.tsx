import { StrictMode, Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import type { HelmetServerState } from '@dr.pogodin/react-helmet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  StaticRouterProvider,
  createStaticHandler,
  createStaticRouter,
  useLocation,
  type RouteObject,
} from 'react-router-dom';

import RootLayout from './layouts/RootLayout';
import Spinner from './components/Spinner';
import { routes } from './routes';
import { AdminAuthProvider } from './lib/adminAuth';

export interface RenderResult {
  html: string;
  head: string;
  status: number;
  redirect?: string;
}

const SpinnerFallback = () => (
  <div className="flex justify-center py-8 h-screen items-center">
    <Spinner />
  </div>
);

function SSRLayoutWrapper() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  if (isAdmin) {
    return (
      <Suspense fallback={<SpinnerFallback />}>
        <Outlet />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<SpinnerFallback />}>
      <RootLayout>
        <Outlet />
      </RootLayout>
    </Suspense>
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
      <HelmetProvider onServerState={(state) => { helmetContext.helmet = state; }}>
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
