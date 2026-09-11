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

  it('provides focused public navigation without a duplicate registration CTA', () => {
    const header = readFileSync('src/layouts/parts/Header.tsx', 'utf8');
    expect(header).toContain('Digital Banking');
    expect(header).toContain('to="/login"');
    expect(header).not.toContain('to="/register"');
    expect(header).not.toContain('Open Account');
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

  it('keeps the public accounts page free of synthetic customer financial data', () => {
    const page = readFileSync('src/pages/accounts.tsx', 'utf8');
    expect(page).toContain('Choose the Account That Fits');
    expect(page).toContain('Start Your Application');
    expect(page).toContain('Explore Digital Banking');
    expect(page).not.toContain('DashboardPreview');
    expect(page).not.toMatch(/Good morning, Alex|ALEX MORGAN|Recent transactions|Asset allocation|What Our Customers Say/i);
    expect(page).not.toMatch(/\$\s?[0-9]|\bLive\b/);
  });

  it('routes the About call to action to the public account-options page', () => {
    const page = readFileSync('src/pages/our-story.tsx', 'utf8');
    expect(page).toContain('to="/accounts"');
    expect(page).toContain('Explore Account Options');
    expect(page).not.toContain('Explore banking');
  });
});
