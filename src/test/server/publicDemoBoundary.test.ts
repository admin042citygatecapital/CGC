import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('published public website boundary', () => {
  it('serves the complete platform homepage at canonical public routes', () => {
    const routes = readFileSync('src/routes.tsx', 'utf8');
    expect(routes).toContain("{ path: '/', element: <HomePage /> }");
    expect(routes).toContain("{ path: '/demo', element: <Navigate to=\"/\" replace /> }");
    expect(routes).toContain("{ path: '/digital-banking', element: <DigitalBankingPage /> }");
    expect(routes).toContain("{ path: '/accounts',  element: <AccountsPage /> }");
    expect(routes).toContain("{ path: '/support', element: <SupportPage /> }");
  });

  it('provides the complete AIRO-style public navigation', () => {
    const header = readFileSync('src/layouts/parts/Header.tsx', 'utf8');
    expect(header).toContain('Digital Banking');
    expect(header).toContain('Open Account');
    expect(header).toContain('to="/login"');
  });

  it('publishes the canonical homepage and public product routes', () => {
    expect(readFileSync('src/pages/index.tsx', 'utf8')).toContain('index, follow');
    const seoRoutes = readFileSync('src/lib/seo-routes.ts', 'utf8');
    expect(seoRoutes).toMatch(/path: "\/digital-banking"/);
    expect(seoRoutes).toMatch(/path: "\/accounts"/);
    expect(seoRoutes).toMatch(/path: "\/support"/);
  });

  it('keeps the corporate homepage factual and partnership-led', () => {
    const page = readFileSync('src/pages/corporate-home.tsx', 'utf8');
    expect(page).toContain('Financial infrastructure,');
    expect(page).toContain('Discuss a partnership');
    expect(page).toContain('Product capabilities are activated only');
    expect(page).not.toMatch(/Open Account|Create Account|Start Banking|insured deposits/i);
  });
});
