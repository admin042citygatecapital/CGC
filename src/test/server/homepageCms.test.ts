import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { home as bundledHomepage } from 'virtual:content';
import { validateHomepageContent } from '../../server/lib/homepageCmsStore';

describe('homepage CMS publication boundary', () => {
  it('accepts the complete bundled homepage document', () => {
    const result = validateHomepageContent(bundledHomepage);
    expect(result.errors).toEqual([]);
    expect(result.content?.hero.headlineAccent).toBe('Banking');
  });

  it('rejects incomplete, malformed and oversized write-ups', () => {
    expect(validateHomepageContent({ hero: {} }).errors.length).toBeGreaterThan(0);
    expect(validateHomepageContent({ ...bundledHomepage, stats: 'invalid' }).errors).toContain('homepage.stats must be a list.');
    expect(validateHomepageContent({
      ...bundledHomepage,
      hero: { ...bundledHomepage.hero, subheadline: 'x'.repeat(2_001) },
    }).errors).toContain('homepage.hero.subheadline is too long.');
  });

  it('wires all homepage modules to the runtime content provider', () => {
    for (const file of [
      'src/sections/BankingModule.tsx',
      'src/sections/TradingModule.tsx',
      'src/sections/WalletsModule.tsx',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain('useHomepageContent');
      expect(source).not.toContain("from 'virtual:content'");
    }
    expect(readFileSync('src/pages/index.tsx', 'utf8')).toContain('HomepageContentProvider');
  });
});
