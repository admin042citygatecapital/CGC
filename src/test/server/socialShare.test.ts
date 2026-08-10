import { describe, expect, it } from 'vitest';
import {
  buildShareTargets,
  normalizeSocialLinks,
  validateProfileUrl,
  validateTargetUrl,
} from '../../server/lib/socialStore.js';

describe('social share center', () => {
  it('accepts verified profile domains and rejects unsafe or mismatched links', () => {
    expect(validateProfileUrl('linkedin', 'https://www.linkedin.com/company/city-gate-capital'))
      .toContain('linkedin.com/company/city-gate-capital');
    expect(() => validateProfileUrl('linkedin', 'javascript:alert(1)')).toThrow();
    expect(() => validateProfileUrl('facebook', 'https://attacker.example/facebook.com')).toThrow();
    expect(() => validateTargetUrl('file:///private/data')).toThrow();
  });

  it('normalizes profile settings and removes unsupported platforms', () => {
    const links = normalizeSocialLinks([
      { platformId: 'twitter', url: 'https://x.com/citygatecapital', enabled: true },
      { platformId: 'unknown', url: 'https://example.com', enabled: true },
    ]);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ platformId: 'twitter', enabled: true });
  });

  it('builds official share intents and safe copy-only fallbacks', () => {
    const targets = buildShareTargets(
      'City Gate Capital update & news',
      'https://citygate.capital/about?source=admin',
      ['twitter', 'linkedin', 'instagram'],
    );
    expect(targets.find(item => item.platformId === 'twitter')).toMatchObject({ mode: 'intent' });
    expect(targets.find(item => item.platformId === 'linkedin')?.url).toContain('linkedin.com/sharing/share-offsite');
    expect(targets.find(item => item.platformId === 'instagram')).toMatchObject({ mode: 'copy' });
    expect(targets[0].url).not.toContain('javascript:');
  });
});
