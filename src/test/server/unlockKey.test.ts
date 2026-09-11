import { describe, expect, it } from 'vitest';
import { unlockKeyMatches } from '../../server/lib/unlockKey';

describe('unlockKeyMatches', () => {
  it('accepts the configured key', () => {
    expect(unlockKeyMatches('correct-key', 'correct-key')).toBe(true);
  });

  it('rejects wrong keys, empty values and missing configuration', () => {
    expect(unlockKeyMatches('wrong-key', 'correct-key')).toBe(false);
    expect(unlockKeyMatches('', 'correct-key')).toBe(false);
    expect(unlockKeyMatches(undefined, 'correct-key')).toBe(false);
    expect(unlockKeyMatches('correct-key', undefined)).toBe(false);
    expect(unlockKeyMatches('correct-key', '')).toBe(false);
  });

  it('rejects keys of different lengths without throwing', () => {
    expect(unlockKeyMatches('short', 'a-much-longer-configured-key')).toBe(false);
  });
});