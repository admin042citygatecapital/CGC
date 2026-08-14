import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateCmsSettings } from '../../server/lib/cmsSettingsStore.js';

describe('durable general CMS settings', () => {
  it('uses the PostgreSQL-backed document store', () => {
    const store = readFileSync('src/server/lib/cmsSettingsStore.ts', 'utf8');
    expect(store).toContain("const KEY = 'admin_cms_settings'");
    expect(store).toContain('readConfigDocument');
    expect(store).toContain('writeConfigDocument');
    for (const file of ['src/server/api/admin/cms/GET.ts', 'src/server/api/admin/cms/POST.ts']) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('readFileSync');
      expect(source).not.toContain('writeFileSync');
    }
  });

  it('accepts bounded scalar fields and rejects nested or oversized data', () => {
    expect(validateCmsSettings({ heroTitle: 'Secure banking tools', enabled: true, order: 1 })).toEqual({ heroTitle: 'Secure banking tools', enabled: true, order: 1 });
    expect(validateCmsSettings({ nested: { unsafe: true } })).toBeNull();
    expect(validateCmsSettings({ updatedAt: 'forged' })).toBeNull();
    expect(validateCmsSettings({ heroTitle: 'x'.repeat(20_001) })).toBeNull();
  });
});
