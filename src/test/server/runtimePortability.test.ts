import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const executableFiles = [
  'package.json',
  'scripts/check-production-guard.mjs',
  'scripts/create-local-demo-user.ts',
  'scripts/start-e2e-server.ts',
  'src/server/db/db.ts',
  'src/server/db/migrate.ts',
  'src/server/lib/envConfig.ts',
  'src/server/lib/envValidator.ts',
];

describe('runtime portability', () => {
  it('has no executable dependency on the AIRO secret contract', () => {
    const sourceFiles = [...executableFiles, 'src/server/entry.ts', 'src/server/lib/adminCredentials.ts', 'src/server/lib/supabaseStorage.ts'];
    for (const file of sourceFiles) expect(readFileSync(file, 'utf8'), file).not.toContain('#airo/secrets');
  });

  it('uses DATABASE_URL as the only executable PostgreSQL connection contract', () => {
    for (const file of executableFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('NEON_CONNECTION_STRING');
      expect(source, file).not.toContain('SUPABASE_DB_URL');
    }
  });
});
