import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = fs.readFileSync(path.resolve(process.cwd(), 'src/routes.tsx'), 'utf8');

describe('customer route contract', () => {
  const requiredRoutes = [
    '/login',
    '/register',
    '/dashboard',
    '/dashboard/accounts',
    '/dashboard/transactions',
    '/dashboard/transfers',
    '/dashboard/beneficiaries',
    '/dashboard/cards',
    '/dashboard/wallets',
    '/dashboard/trading',
    '/dashboard/support',
    '/dashboard/security',
    '/dashboard/settings',
  ];

  it('registers every required customer route', () => {
    for (const route of requiredRoutes) {
      expect(routes).toContain(`path: '${route}'`);
    }
  });

  it('uses the customer authentication boundary for protected customer pages', () => {
    for (const route of requiredRoutes.filter(route => route.startsWith('/dashboard'))) {
      const routeLine = routes.split('\n').find(line => line.includes(`path: '${route}'`));
      expect(routeLine, route).toContain('<CustomerOnly>');
      expect(routeLine, route).not.toContain('<AdminOnly>');
    }
  });

  it('never sends the customer authentication boundary to administration', () => {
    const start = routes.indexOf('function CustomerOnly');
    const end = routes.indexOf('function FeatureOnly');
    const customerBoundary = routes.slice(start, end);
    expect(customerBoundary).toContain("navigate('/login?reason=session_expired'");
    expect(customerBoundary).not.toContain('/admin');
  });

  it('uses a dedicated transaction-history page', () => {
    expect(routes).toContain("import('./pages/dashboard/transactions')");
    expect(routes).toContain('<DashboardTransactions />');
  });
});
