import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'src/server/db/migrations/0055_trusted_backend_user_updates.sql',
  'utf8',
);

describe('trusted backend user guard migration', () => {
  it('allows only the Supabase service role and current trusted direct database role', () => {
    expect(migration).toContain("auth.role() = 'service_role'");
    expect(migration).toContain("session_user = 'postgres'");
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.guard_users_privileged_columns()');
  });

  it('preserves browser-facing protections for privileged user fields', () => {
    expect(migration).toContain('Not allowed to change account status');
    expect(migration).toContain('Not allowed to change email_verified directly');
    expect(migration).toContain('Not allowed to change password_hash directly');
    expect(migration).toContain('Not allowed to change auth token fields directly');
    expect(migration).toContain('Not allowed to change login/security telemetry fields directly');
  });

  it('contains no destructive schema or data operation', () => {
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\b/i);
  });
});
