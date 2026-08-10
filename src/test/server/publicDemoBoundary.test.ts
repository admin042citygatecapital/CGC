import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public website and demo boundary', () => {
  it('serves a corporate homepage and moves product demonstrations under /demo', () => {
    const routes = readFileSync('src/routes.tsx', 'utf8');
    expect(routes).toContain("{ path: '/', element: <CorporateHomePage /> }");
    expect(routes).toContain("{ path: '/demo', element: <HomePage /> }");
    expect(routes).toContain('to="/demo/digital-banking"');
    expect(routes).toContain('to="/demo/accounts"');
    expect(routes).toContain('to="/demo/support"');
  });

  it('does not market unavailable retail banking from the corporate header', () => {
    const header = readFileSync('src/layouts/parts/Header.tsx', 'utf8');
    expect(header).toContain("{ label: 'Platform Demo',   href: '/demo'");
    expect(header).toContain('Partner With Us');
    expect(header).not.toContain('Open Account');
    expect(header).not.toContain('to="/login"');
  });

  it('keeps demo pages out of search indexing and the public sitemap', () => {
    for (const file of [
      'src/pages/index.tsx',
      'src/pages/accounts.tsx',
      'src/pages/digital-banking.tsx',
      'src/pages/support.tsx',
    ]) {
      expect(readFileSync(file, 'utf8'), file).toContain('noindex, nofollow');
    }
    const seoRoutes = readFileSync('src/lib/seo-routes.ts', 'utf8');
    expect(seoRoutes).not.toMatch(/path: "\/(?:demo|digital-banking|accounts|support)/);
  });

  it('keeps the corporate homepage factual and partnership-led', () => {
    const page = readFileSync('src/pages/corporate-home.tsx', 'utf8');
    expect(page).toContain('Financial infrastructure,');
    expect(page).toContain('Discuss a partnership');
    expect(page).toContain('Product capabilities are activated only');
    expect(page).not.toMatch(/Open Account|Create Account|Start Banking|insured deposits/i);
  });
});
