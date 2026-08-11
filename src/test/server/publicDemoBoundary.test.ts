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

  it.each([
    ['digital-banking', 'src/pages/digital-banking.tsx'],
    ['accounts', 'src/pages/accounts.tsx'],
    ['support', 'src/pages/support.tsx'],
  ])('keeps the public %s page indexable with its production canonical', (path, file) => {
    const page = readFileSync(file, 'utf8');
    expect(page).toContain('<meta name="robots" content="index, follow" />');
    expect(page).toContain(`<link rel="canonical" href="https://citygate.capital/${path}" />`);
    expect(page).not.toContain('https://citygate.capital/demo/');
  });

  it('keeps the corporate homepage factual and partnership-led', () => {
    const page = readFileSync('src/pages/corporate-home.tsx', 'utf8');
    expect(page).toContain('Financial infrastructure,');
    expect(page).toContain('Discuss a partnership');
    expect(page).toContain('Product capabilities are activated only');
    expect(page).not.toMatch(/Open Account|Create Account|Start Banking|insured deposits/i);
  });
});
