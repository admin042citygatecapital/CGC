/**
 * Agent-editable registry of publicly-crawlable routes. Consumed by the
 * /sitemap.xml handler in src/server/entry.ts.
 *
 * Guidelines for maintaining this file:
 * - Add a new entry whenever you add a new publicly-crawlable page.
 * - Do not include dynamic-param routes like "/products/:id" directly.
 *   Instead, enumerate real values (e.g. "/products/desk-pro") or skip.
 * - `path` MUST start with "/".
 * - Priorities are between 0.0 and 1.0. Home = 1.0, main sections = 0.8,
 *   deep pages = 0.5.
 * - Dev-only or auth-required routes MUST NOT be listed.
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
	{ path: "/",                  changefreq: "weekly",  priority: 1.0, lastmod: "2026-05-27" },
	{ path: "/digital-banking",   changefreq: "monthly", priority: 0.9, lastmod: "2026-05-27" },
	// /wallet and /transfers require customer auth — excluded from sitemap
	{ path: "/accounts",          changefreq: "monthly", priority: 0.9, lastmod: "2026-05-27" },
	{ path: "/about",             changefreq: "monthly", priority: 0.7, lastmod: "2026-05-27" },
	{ path: "/support",           changefreq: "weekly",  priority: 0.7, lastmod: "2026-05-27" },
	{ path: "/contact",           changefreq: "yearly",  priority: 0.6, lastmod: "2026-05-27" },
	{ path: "/privacy-policy",    changefreq: "yearly",  priority: 0.4, lastmod: "2026-05-27" },
	{ path: "/terms-of-service",  changefreq: "yearly",  priority: 0.4, lastmod: "2026-05-27" },
	{ path: "/cookie-policy",     changefreq: "yearly",  priority: 0.4, lastmod: "2026-05-27" },
	{ path: "/compliance",        changefreq: "monthly", priority: 0.5, lastmod: "2026-05-27" },
];
