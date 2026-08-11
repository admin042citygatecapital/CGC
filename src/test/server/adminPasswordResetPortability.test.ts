import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('administrator password reset portability', () => {
  it('does not claim to persist an immutable deployment secret', () => {
    const source = readFileSync('src/server/api/admin/auth/password-reset/confirm/POST.ts', 'utf8');
    expect(source).not.toContain('setSecret');
    expect(source).not.toContain('admin_password_reset_success');
    expect(source).toContain('res.status(503)');
    expect(source).toContain('admin_password_reset_unavailable');
  });
});
