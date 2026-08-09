/**
 * prefetchRoute — triggers a dynamic import for a route's chunk on hover,
 * so the JS is already in the browser cache when the user clicks.
 *
 * Usage in a nav link:
 *   <Link to="/about" onMouseEnter={() => prefetchRoute('/about')}>About</Link>
 */

// Map of path → import factory (must match routes.tsx lazy imports exactly)
const routeImports: Record<string, () => Promise<unknown>> = {
  // ── Public pages ──────────────────────────────────────────────────────────
  '/':                () => import('../pages/index'),
  '/about':           () => import('../pages/about'),
  '/digital-banking': () => import('../pages/digital-banking'),
  '/wallet':          () => import('../pages/wallet'),
  '/accounts':        () => import('../pages/accounts'),
  '/transfers':       () => import('../pages/transfers'),
  '/support':         () => import('../pages/support'),
  '/contact':         () => import('../pages/contact'),

  // ── Customer dashboard ────────────────────────────────────────────────────
  '/dashboard':                    () => import('../pages/dashboard/wallets'),
  '/dashboard/wallets':            () => import('../pages/dashboard/wallets'),
  '/dashboard/analytics':          () => import('../pages/dashboard/analytics'),
  '/dashboard/cards':              () => import('../pages/dashboard/cards'),
  '/dashboard/transfers':          () => import('../pages/dashboard/transfers'),
  '/dashboard/deposits':           () => import('../pages/dashboard/deposits'),
  '/dashboard/statements':         () => import('../pages/dashboard/statements'),
  '/dashboard/notifications':      () => import('../pages/dashboard/notifications'),
  '/dashboard/security':           () => import('../pages/dashboard/security'),
  '/dashboard/devices':            () => import('../pages/dashboard/devices'),
  '/dashboard/beneficiaries':      () => import('../pages/dashboard/beneficiaries'),
  '/dashboard/rates':              () => import('../pages/dashboard/rates'),
  '/dashboard/exchange':           () => import('../pages/dashboard/rates'),
  '/dashboard/profile':            () => import('../pages/dashboard/profile'),
  '/dashboard/settings':           () => import('../pages/dashboard/settings'),

  // ── Trading hub + all sub-routes ──────────────────────────────────────────
  '/dashboard/trading':            () => import('../pages/dashboard/trading'),
  '/dashboard/trading/spot':       () => import('../pages/dashboard/trading/spot'),
  '/dashboard/trading/markets':    () => import('../pages/dashboard/trading/markets'),
  '/dashboard/trading/chart':      () => import('../pages/dashboard/trading/chart'),
  '/dashboard/trading/watchlist':  () => import('../pages/dashboard/trading/watchlist'),
  '/dashboard/trading/orders':     () => import('../pages/dashboard/trading/orders'),
  '/dashboard/trading/trades':     () => import('../pages/dashboard/trading/trades'),
  '/dashboard/trading/analytics':  () => import('../pages/dashboard/trading/analytics'),

  // ── Admin routes — only prefetch if already on /admin ────────────────────
  '/admin':              () => import('../pages/admin/index'),
  '/admin/users':        () => import('../pages/admin/users'),
  '/admin/transactions': () => import('../pages/admin/transactions'),
  '/admin/security':     () => import('../pages/admin/security'),
  '/admin/settings':     () => import('../pages/admin/settings'),
  '/admin/support':      () => import('../pages/admin/support'),
  '/admin/cms':          () => import('../pages/admin/cms'),
  '/admin/newsletter':   () => import('../pages/admin/newsletter'),
  '/admin/contacts':     () => import('../pages/admin/contacts'),
  '/admin/operations':   () => import('../pages/admin/operations'),
  '/admin/banking':      () => import('../pages/admin/banking'),
  '/admin/crypto':       () => import('../pages/admin/crypto'),
  '/admin/trading':      () => import('../pages/admin/trading'),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;
  const factory = routeImports[path];
  if (!factory) return;
  prefetched.add(path);
  // Fire-and-forget — errors are silently ignored (network may be offline)
  factory().catch(() => {});
}

/**
 * Prefetch a group of related routes at once.
 * Useful when entering a section (e.g. prefetch all trading sub-routes
 * when the user hovers the Trading Hub link).
 */
export function prefetchRouteGroup(paths: string[]): void {
  paths.forEach(prefetchRoute);
}

/** Prefetch all trading sub-routes — call on hover of the Trading Hub tile */
export function prefetchTradingRoutes(): void {
  prefetchRouteGroup([
    '/dashboard/trading',
    '/dashboard/trading/spot',
    '/dashboard/trading/markets',
    '/dashboard/trading/chart',
    '/dashboard/trading/watchlist',
    '/dashboard/trading/orders',
    '/dashboard/trading/trades',
    '/dashboard/trading/analytics',
  ]);
}
