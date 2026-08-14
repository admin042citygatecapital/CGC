import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCOUNT_PLANS, normalizeAccountPlans } from '../../lib/accountPlans.js';

describe('account plan management', () => {
  it('keeps exactly the controlled Standard, Premium and Elite records', () => {
    const plans = normalizeAccountPlans([{ id: 'standard', name: 'Starter', features: ['Digital Wallets'] }, { id: 'unknown', name: 'Unsafe' }]);
    expect(plans.map(plan => plan.id)).toEqual(['standard', 'premium', 'elite']);
    expect(plans[0].name).toBe('Starter');
    expect(plans[0].features).toEqual(['Digital Wallets']);
    expect(DEFAULT_ACCOUNT_PLANS).toHaveLength(3);
  });

  it('rejects unsafe external CTA destinations during normalization', () => {
    const plans = normalizeAccountPlans([{ id: 'elite', ctaLink: 'https://example.com/phishing' }]);
    expect(plans[2].ctaLink).toBe('/contact?service=elite-digital-banking');
  });

  it('migrates saved legacy feature labels into the current comparison model', () => {
    const plans = normalizeAccountPlans([{
      id: 'elite',
      features: ['Financial Analytics', 'Layered Security', 'Concierge & Onboarding'],
    }]);
    expect(plans[2].features).toEqual([
      'Financial Dashboard',
      'Smart Analytics',
      'Bill Payments',
      'Enhanced Security',
      'White-Glove Onboarding',
      'Concierge Services',
    ]);
  });

  it('migrates prior card, portfolio and API labels into the current account comparison', () => {
    const plans = normalizeAccountPlans([{
      id: 'elite',
      features: ['Smart Card Experience', 'Portfolio & Market View', 'Business & API Capabilities'],
    }]);
    expect(plans[2].features).toEqual([
      'Virtual Card Experience',
      'Physical Card Experience',
      'Investment & Portfolio View',
      'Business & API Access',
    ]);
  });

  it('projects plans publicly and preserves super-admin, CSRF and audit controls for writes', () => {
    const publicRoute = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/settings/website/GET.ts'), 'utf8');
    const adminRoute = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/admin/website/POST.ts'), 'utf8');
    const publicPage = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/digital-banking.tsx'), 'utf8');
    const adminPage = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/website.tsx'), 'utf8');
    expect(publicRoute).toContain('accountPlans: normalizeAccountPlans');
    expect(adminRoute).toContain('admin_website_settings_updated');
    expect(publicPage).toContain("fetch('/api/settings/website')");
    expect(publicPage).toContain("name: 'Digital-Asset View'");
    expect(publicPage).toContain("name: 'Physical Card Experience'");
    expect(adminPage).toContain('Account Plan Management');
    expect(adminPage).toContain('authHeaders()');
  });
});
