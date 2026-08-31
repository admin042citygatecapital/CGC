import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('legacy customer address compatibility migration', () => {
  const migration = readFileSync(
    'src/server/db/migrations/0054_users_address_text_compatibility.sql',
    'utf8',
  );

  it('changes only the legacy JSONB address column to canonical text', () => {
    expect(migration).toContain("current_type = 'jsonb'");
    expect(migration).toMatch(/ALTER COLUMN address TYPE text/i);
    expect(migration).toContain("jsonb_typeof(address) = 'string'");
  });

  it('preserves existing values and does not delete customer data', () => {
    expect(migration).toContain("WHEN address IS NULL THEN NULL");
    expect(migration).toContain("ELSE address::text");
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\b/i);
  });
});
