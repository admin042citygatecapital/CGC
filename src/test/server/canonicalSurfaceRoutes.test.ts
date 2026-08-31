import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routes = readFileSync('src/routes.tsx', 'utf8');

describe('canonical platform surfaces', () => {
  it('exposes the required legal routes without a demonstration redirect', () => {
    for (const path of ['/legal/privacy', '/legal/terms', '/legal/cookies']) {
      expect(routes).toContain(`path: '${path}'`);
    }
  });

  it('keeps every canonical customer application route behind CustomerOnly', () => {
    for (const path of [
      '/dashboard/accounts', '/dashboard/transactions', '/dashboard/transfers',
      '/dashboard/beneficiaries', '/dashboard/cards', '/dashboard/wallets',
      '/dashboard/trading', '/dashboard/portfolio', '/dashboard/support',
      '/dashboard/security', '/dashboard/settings', '/dashboard/profile',
      '/dashboard/disputes',
    ]) {
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(routes).toMatch(new RegExp(`path: '${escaped}'[^\\n]*<CustomerOnly>`));
    }
  });

  it('keeps every canonical administration route behind AdminOnly', () => {
    for (const path of [
      '/admin/customers', '/admin/accounts', '/admin/transactions', '/admin/transfers',
      '/admin/cards', '/admin/crypto', '/admin/trading', '/admin/kyc',
      '/admin/compliance', '/admin/security', '/admin/support', '/admin/email',
      '/admin/integrations', '/admin/rates', '/admin/cms', '/admin/media',
      '/admin/configuration', '/admin/audit', '/admin/system',
    ]) {
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(routes).toMatch(new RegExp(`path: '${escaped}'[^\\n]*<AdminOnly>`));
    }
    expect(routes).toContain("path: '/admin/wallets',      element: <Navigate to=\"/admin/crypto\" replace />");
  });
});
