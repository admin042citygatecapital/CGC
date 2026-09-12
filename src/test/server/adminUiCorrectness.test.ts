import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/layouts/AdminLayout.tsx', 'utf8');
const config = readFileSync('src/pages/admin/config.tsx', 'utf8');
const integrations = readFileSync('src/pages/admin/integrations.tsx', 'utf8');
const routes = readFileSync('src/routes.tsx', 'utf8');
const entry = readFileSync('src/server/entry.ts', 'utf8');
const transactions = readFileSync('src/pages/admin/transactions.tsx', 'utf8');
const auditRoute = readFileSync('src/server/api/admin/audit/GET.ts', 'utf8');
const emailStatusRoute = readFileSync('src/server/api/admin/email/status/GET.ts', 'utf8');
const emailPage = readFileSync('src/pages/admin/email.tsx', 'utf8');

describe('administrator UI correctness', () => {
  it('links operations to their canonical, accurately described destinations', () => {
    expect(layout).toContain("label: 'Transfers',    href: '/admin/transfers'");
    expect(layout).toContain("label: 'Wallets & Digital Assets', href: '/admin/crypto'");
    expect(layout).toContain("href: '/admin/features'");
    expect(layout).toContain('isNavItemActive(item.href, location.pathname, location.search)');
  });

  it('keeps development and secret-inventory surfaces out of production admin navigation', () => {
    for (const label of ['API Docs', 'Sponsor Readiness', 'Provider Sandbox', 'Assurance Exercises', 'Developer']) {
      expect(layout).not.toContain(`label: '${label}'`);
    }
    expect(routes).not.toContain("path: '/admin/developer'");
    expect(routes).not.toContain("path: '/admin/provider-sandbox'");
    expect(routes).toContain("path: '/admin/financial-sandbox', element: <AdminOnly><AdminFinancialSandbox /></AdminOnly>");
    expect(layout).toContain("label: 'Financial Sandbox', href: '/admin/financial-sandbox'");
    expect(layout).toContain('Isolated simulations; no live money movement');
    expect(routes).toContain("path: '/admin/wallets',      element: <Navigate to=\"/admin/crypto\" replace />");
    expect(entry).not.toContain('app.get("/api/admin/developer"');
    expect(entry).not.toContain('app.get("/api/admin/env-report"');
  });

  it('supports opening the feature-toggle section directly', () => {
    expect(config).toContain("const requestedSection = searchParams.get('section')");
    expect(config).toContain('isSectionId(requestedSection)');
    expect(config).toContain("activeSection === 'featureToggles'");
    expect(config).toContain('role="switch"');
    expect(config).toContain('aria-checked={value}');
    expect(config).toContain("{value ? 'Enabled' : 'Disabled'}");
  });

  it('opens transfers as a focused transfer review instead of a duplicate register', () => {
    expect(routes).toContain('<AdminTransactions view="transfers" />');
    expect(transactions).toContain("view?: 'transactions' | 'transfers'");
    expect(transactions).toMatch(/transfersOnly\s*\? \['transfer', 'wire_transfer'\]/);
  });

  it('does not report integration mutations as successful after a rejected response', () => {
    expect(integrations).toContain("if (!res.ok) throw new Error(responseErrorMessage");
    expect(integrations).toContain('setActionError(`Unable to update integration:');
    expect(integrations).toContain('setActionError(`Unable to save integration:');
    expect(integrations).toContain('if (!res.ok) {');
    expect(integrations).not.toContain('catch { /* silent */ }');
    expect(integrations).toContain("label: 'Active market feeds'");
    expect(integrations).toContain('marketProviders.length');
  });

  it('keeps email diagnostics bounded and gives administrators a retryable error state', () => {
    expect(emailStatusRoute).toContain('PROVIDER_CHECK_TIMEOUT_MS');
    expect(emailStatusRoute).toContain('Promise.race');
    expect(emailPage).toContain('controller.abort()');
    expect(emailPage).toContain('No delivery settings were changed.');
    expect(emailPage).toContain('onClick={load}');
  });

  it('paginates audit records at the database boundary', () => {
    expect(auditRoute).toContain('getAuditLogPage');
    expect(auditRoute).not.toContain('limit: 10000');
    expect(auditRoute).not.toContain('.slice(offset');
  });

  it('exposes one KYC workspace and first-class operational pages', () => {
    expect(layout).toContain("label: 'KYC & Onboarding'");
    expect(layout).not.toContain("label: 'KYC Review'");
    expect(layout).not.toContain("label: 'Onboarding Cases'");
    expect(routes).toContain("path: '/admin/kyc',             element: <AdminOnly><Navigate to=\"/admin/onboarding\" replace /></AdminOnly>");
    for (const path of ['/admin/administrators', '/admin/deployments', '/admin/database']) {
      expect(routes).toContain(`path: '${path}'`);
    }
    expect(entry).toContain('app.get("/api/admin/administrators"');
    expect(entry).toContain('app.get("/api/admin/deployments"');
    expect(entry).toContain('app.get("/api/admin/database"');
  });
});
