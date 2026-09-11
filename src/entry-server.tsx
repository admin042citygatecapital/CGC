import type { HelmetServerState } from '@dr.pogodin/react-helmet';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { StrictMode,type ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import {
StaticRouterProvider,
createStaticHandler,
createStaticRouter,
type RouteObject,
} from 'react-router-dom';

import { SSRLayoutWrapper } from './components/SSRLayoutWrapper';
import { AdminAuthProvider } from './lib/adminAuthProvider';
import { CustomerAuthProvider } from './lib/customerAuthProvider';
import { routes } from './routes';

export interface RenderResult {
  html: string;
  head: string;
  status: number;
  redirect?: string;
}

const routeTree: RouteObject[] = [
  {
    element: <SSRLayoutWrapper />,
    children: routes,
  },
];

const handler = createStaticHandler(routeTree);

function renderAllReady(element: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    let settled = false;
    let renderError: unknown;
    let abortRender = () => {};

    output.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    output.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      abortRender();
      reject(error);
    });
    output.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (renderError) {
        reject(renderError);
      } else {
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      abortRender();
      reject(new Error('Server rendering timed out before all content was ready.'));
    }, 15_000);

    const { pipe, abort } = renderToPipeableStream(element, {
      onAllReady() {
        if (settled) return;
        if (renderError) {
          settled = true;
          clearTimeout(timeout);
          abort();
          reject(renderError);
          return;
        }
        pipe(output);
      },
      onShellError(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      },
      onError(error) {
        renderError ??= error;
      },
    });
    abortRender = abort;
  });
}

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

  const html = await renderAllReady(
    <StrictMode>
      <HelmetProvider context={helmetContext}>
        <QueryClientProvider client={queryClient}>
          <AdminAuthProvider>
            <CustomerAuthProvider>
              <StaticRouterProvider router={router} context={context} />
            </CustomerAuthProvider>
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
