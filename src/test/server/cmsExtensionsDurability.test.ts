import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('durable extended CMS records', () => {
  it('uses distinct PostgreSQL-backed documents for every extended CMS domain', () => {
    const store = readFileSync('src/server/lib/cmsExtStore.ts', 'utf8');
    for (const key of ['cms_ext_hero_media','cms_ext_logo','cms_ext_navigation','cms_ext_features','cms_ext_news','cms_ext_blog']) {
      expect(store).toContain(key);
    }
    expect(store).toContain('readConfigDocument');
    expect(store).toContain('writeConfigDocument');
    expect(store).not.toContain('writeFileSync');
    expect(store).not.toContain('appendFileSync');
  });

  it('awaits every extended CMS read and mutation route', () => {
    const domains = ['hero','logo','navigation','features','news','blog'];
    for (const domain of domains) {
      for (const method of ['GET','POST']) {
        const file = `src/server/api/admin/cms/${domain}/${method}.ts`;
        const source = readFileSync(file, 'utf8');
        expect(source, file).toContain('async function handler');
        expect(source, file).toContain('await ');
        expect(source, file).not.toContain('error: String(err)');
      }
    }
  });
});
