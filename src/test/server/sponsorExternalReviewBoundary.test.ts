import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('independent sponsor-review browser boundary', () => {
  it('keeps the credential out of storage, cookies, URLs and admin authentication', () => {
    const page = readFileSync('src/pages/sponsor-review.tsx', 'utf8');
    expect(page).toContain("headers: { 'x-sponsor-reviewer-key': key }");
    expect(page).toContain("credentials: 'omit'");
    expect(page).toContain('type="password"');
    expect(page).not.toContain('localStorage');
    expect(page).not.toContain('sessionStorage');
    expect(page).not.toContain('document.cookie');
    expect(page).not.toContain('useAdminAuth');
    expect(page).not.toContain('authHeaders');
  });

  it('excludes the reviewer workspace from support telemetry and search indexing', () => {
    const routes = readFileSync('src/routes.tsx', 'utf8');
    const app = readFileSync('src/App.tsx', 'utf8');
    const support = readFileSync('src/lib/tawkSupport.ts', 'utf8');
    const server = readFileSync('src/server/entry.ts', 'utf8');
    expect(routes).toContain("{ path: '/sponsor-review', element: <SponsorReviewPage /> }");
    expect(app).toContain("'/sponsor-review'");
    expect(support).toContain("pathname !== '/sponsor-review'");
    expect(server).toContain('"Disallow: /sponsor-review"');
    expect(server).toContain("'/sponsor-review',");
  });
});
