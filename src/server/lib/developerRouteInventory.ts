export interface DeveloperRouteEntry {
  method: string;
  path: string;
  group: string;
  auth: 'public' | 'customer' | 'admin';
  description: string;
}

export interface ExpressRouteLayer {
  route?: {
    path?: string | string[];
    methods?: Record<string, boolean>;
  };
}

export interface ExpressRouteSource {
  router?: { stack?: ExpressRouteLayer[] };
  _router?: { stack?: ExpressRouteLayer[] };
}

const PUBLIC_ADMIN_PATHS = new Set([
  '/api/admin/auth/login',
  '/api/admin/auth/password-reset',
  '/api/admin/auth/password-reset/confirm',
  '/api/admin/auth/otp/verify',
  '/api/admin/auth/unlock',
  '/api/admin/auth/diag',
  '/api/admin/auth/verify',
  '/api/admin/zoho/oauth/callback',
]);

const PUBLIC_CUSTOMER_PATHS = new Set([
  '/api/users/register',
  '/api/users/login',
  '/api/users/verify-email',
  '/api/users/password-reset',
  '/api/users/password-reset/confirm',
  '/api/users/kyc-document',
]);

export function classifyRouteAuth(path: string): DeveloperRouteEntry['auth'] {
  if (path.startsWith('/api/admin/')) return PUBLIC_ADMIN_PATHS.has(path) ? 'public' : 'admin';
  if (path.startsWith('/api/users/')) return PUBLIC_CUSTOMER_PATHS.has(path) ? 'public' : 'customer';
  if (path === '/api/analytics/event') return 'public';
  if (path.startsWith('/api/analytics/')) return 'admin';
  if (path === '/api/newsletter/send-sequence' || path.startsWith('/api/newsletter/subscribers')) return 'admin';
  if (path === '/api/zoho/connect' || path === '/api/zoho/status') return 'admin';
  return 'public';
}

function groupForPath(path: string): string {
  if (path.startsWith('/api/admin/auth/')) return 'Admin Auth';
  if (path.startsWith('/api/admin/')) {
    const area = path.split('/')[3] ?? 'platform';
    if (['developer', 'documentation', 'health', 'readiness', 'stats', 'env-report'].includes(area)) return 'Platform';
    return area.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : part).join(' ');
  }
  if (path.startsWith('/api/users/')) return PUBLIC_CUSTOMER_PATHS.has(path) ? 'Customer Auth' : 'Customer';
  if (path.startsWith('/api/analytics/')) return 'Analytics';
  if (path.startsWith('/api/market/')) return 'Market Data';
  if (path.startsWith('/api/newsletter/')) return 'Newsletter';
  if (path.startsWith('/api/settings/')) return 'Public Settings';
  if (path.startsWith('/api/zoho/')) return 'Zoho OAuth';
  if (path.startsWith('/api/accounts/')) return 'Account Applications';
  return 'Public';
}

function isLockedFinancialMutation(path: string, method: string): boolean {
  if (method === 'GET') return false;
  return [
    /^\/api\/users\/(deposit|withdraw|transfer|transfers|swap)(\/|$)/,
    /^\/api\/users\/cards(\/|$)/,
    /^\/api\/admin\/(balance|cards|transactions|trading|wallets)(\/|$)/,
  ].some(pattern => pattern.test(path));
}

function safeDescription(
  path: string,
  method: string,
  auth: DeveloperRouteEntry['auth'],
  metadataDescription?: string,
): string {
  if (isLockedFinancialMutation(path, method)) {
    return 'Preview-locked financial operation endpoint; no live provider execution.';
  }
  if (path.startsWith('/api/admin/sponsor-readiness')) {
    return 'Sponsor-readiness evidence workflow; approval does not enable financial operations.';
  }
  if (metadataDescription) return metadataDescription;
  const audience = auth === 'admin' ? 'Administrator' : auth === 'customer' ? 'Authenticated customer' : 'Public';
  return `${audience} ${method} endpoint registered by the running server.`;
}

export function getRegisteredRouteCatalogue(
  source: ExpressRouteSource,
  metadata: readonly DeveloperRouteEntry[] = [],
): DeveloperRouteEntry[] {
  const stack = source.router?.stack ?? source._router?.stack ?? [];
  const entries: DeveloperRouteEntry[] = [];
  const metadataByRoute = new Map(metadata.map(entry => [`${entry.method}:${entry.path}`, entry]));

  for (const layer of stack) {
    if (!layer.route?.path || !layer.route.methods) continue;
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    const methods = Object.entries(layer.route.methods)
      .filter(([, enabled]) => enabled)
      .map(([method]) => method.toUpperCase());

    for (const path of paths) {
      if (!path.startsWith('/api/')) continue;
      for (const method of methods) {
        const auth = classifyRouteAuth(path);
        const metadataEntry = metadataByRoute.get(`${method}:${path}`);
        entries.push({
          method,
          path,
          group: groupForPath(path),
          auth,
          description: safeDescription(path, method, auth, metadataEntry?.description),
        });
      }
    }
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
