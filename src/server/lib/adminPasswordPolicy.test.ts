import { describe, expect, it } from 'vitest';

import { validateAdminPassword } from './adminPasswordPolicy.js';

describe('administrator password policy', () => {
  it('accepts a long mixed-character password', () => {
    expect(validateAdminPassword('Correct-Horse-7!Battery').ok).toBe(true);
  });

  it('rejects weak and organisation-derived passwords', () => {
    expect(validateAdminPassword('short').ok).toBe(false);
    expect(validateAdminPassword('CityGateCapital-2026!').ok).toBe(false);
  });
});
