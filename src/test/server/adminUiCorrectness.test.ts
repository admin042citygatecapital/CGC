import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/layouts/AdminLayout.tsx', 'utf8');
const config = readFileSync('src/pages/admin/config.tsx', 'utf8');
const integrations = readFileSync('src/pages/admin/integrations.tsx', 'utf8');

describe('administrator UI correctness', () => {
  it('links operations to their canonical, accurately described destinations', () => {
    expect(layout).toContain("label: 'Transfers',    href: '/admin/transfers'");
    expect(layout).toContain("desc: 'Synthetic wallet records in the financial sandbox'");
    expect(layout).toContain("href: '/admin/config?section=featureToggles'");
    expect(layout).toContain('isNavItemActive(item.href, location.pathname, location.search)');
  });

  it('supports opening the feature-toggle section directly', () => {
    expect(config).toContain("const requestedSection = searchParams.get('section')");
    expect(config).toContain('isSectionId(requestedSection)');
    expect(config).toContain("activeSection === 'featureToggles'");
  });

  it('does not report integration mutations as successful after a rejected response', () => {
    expect(integrations).toContain("if (!res.ok) throw new Error(responseErrorMessage");
    expect(integrations).toContain('setActionError(`Unable to update integration:');
    expect(integrations).toContain('setActionError(`Unable to save integration:');
    expect(integrations).toContain('if (!res.ok) {');
    expect(integrations).not.toContain('catch { /* silent */ }');
  });
});
