/**
 * Auto-synced registry of publicly-crawlable routes. Consumed by the
 * /sitemap.xml handler in src/server/entry.ts.
 *
 * DO NOT add or remove paths by hand. Static paths are mirrored here from
 * src/routes.tsx automatically whenever that file is edited (any manual
 * path edit would be overwritten on the next routes.tsx change). For sync
 * to pick up a route, its `path` must be a literal string starting with "/";
 * template literals and identifier refs are skipped, and dynamic-param routes
 * like "/products/:id" are excluded.
 *
 * The only fields safe to hand-edit are the per-entry metadata below, after a
 * sync:
 * - `priority` (0.0–1.0): Home = 1.0, main sections = 0.8, deep pages = 0.5.
 * - `changefreq` and `lastmod`.
 */

export interface SeoRoute {
  path: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
  lastmod?: string;
}

export const seoRoutes: SeoRoute[] = [
  { path: "/", changefreq: "weekly", priority: 1.0, lastmod: "2026-08-11" },
  { path: "/about", changefreq: "monthly", priority: 0.8, lastmod: "2026-08-15" },
  { path: "/digital-banking", changefreq: "monthly", priority: 0.8, lastmod: "2026-08-11" },
  { path: "/accounts", changefreq: "monthly", priority: 0.8, lastmod: "2026-08-11" },
  { path: "/support", changefreq: "monthly", priority: 0.6, lastmod: "2026-08-11" },
  // Legacy /demo paths redirect to their canonical public equivalents.
  // /wallet and /transfers are auth-gated (CustomerOnly) — excluded from sitemap
  { path: "/contact", changefreq: "yearly", priority: 0.6, lastmod: "2026-07-12" },
  { path: "/privacy-policy", changefreq: "yearly", priority: 0.4, lastmod: "2026-07-12" },
  { path: "/terms-of-service", changefreq: "yearly", priority: 0.4, lastmod: "2026-07-12" },
  { path: "/cookie-policy", changefreq: "yearly", priority: 0.4, lastmod: "2026-07-12" },
  { path: "/compliance", changefreq: "monthly", priority: 0.5, lastmod: "2026-07-12" },
  // /analytics and /newsletter are AdminOnly — excluded from sitemap
  // Auth pages — indexable so search engines can surface the login/register entry points
  // KYC — noindex in page Helmet, excluded from sitemap
  // Forgot/reset password — utility pages, not useful to crawlers
  // /dashboard/** — auth-gated, noindex in page Helmet, excluded from sitemap
  // /admin/**     — auth-gated, noindex in page Helmet, excluded from sitemap
];
