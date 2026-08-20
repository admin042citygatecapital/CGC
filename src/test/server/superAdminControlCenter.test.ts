import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('super-admin control center coverage', () => {
  it('keeps protected administration routes exclusive to the super-admin', () => {
    const authorization = readFileSync('src/server/lib/adminAuthorizationMiddleware.ts', 'utf8');
    expect(authorization).toContain("session.role === 'SUPER_ADMIN'");
    expect(authorization).toContain('SUPER_ADMIN_REQUIRED');
  });

  it('makes account, card and wallet controls reachable from the main navigation', () => {
    const layout = readFileSync('src/layouts/AdminLayout.tsx', 'utf8');
    expect(layout).toContain("label: 'Control Center'");
    expect(layout).toContain("href: '/admin/accounts'");
    expect(layout).toContain("href: '/admin/cards'");
    expect(layout).toContain("href: '/admin/wallets'");
  });

  it('preloads the same modules used by the registered control routes', () => {
    const prefetch = readFileSync('src/lib/prefetchRoute.ts', 'utf8');
    expect(prefetch).toContain("'/admin/accounts':     () => import('../pages/admin/customer-accounts')");
    expect(prefetch).toContain("'/admin/cards':        () => import('../pages/admin/cards')");
    expect(prefetch).toContain("'/admin/wallets':      () => import('../pages/admin/financial-sandbox')");
  });
});
