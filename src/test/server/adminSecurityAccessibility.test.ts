import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('administrator security-control accessibility', () => {
  it('exposes the 2FA policy toggles as named switch controls', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/security.tsx'), 'utf8');
    expect(source).toContain('role="switch"');
    expect(source).toContain('aria-checked=');
    expect(source).toContain('aria-label={label}');
    expect(source).toContain('type="button"');
  });
});
