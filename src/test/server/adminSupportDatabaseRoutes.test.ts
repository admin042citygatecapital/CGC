import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const databaseBackedRoutes = [
  'src/server/api/admin/support/GET.ts',
  'src/server/api/admin/support/assign/POST.ts',
  'src/server/api/admin/support/bulk/POST.ts',
  'src/server/api/admin/support/note/POST.ts',
  'src/server/api/admin/support/priority/POST.ts',
  'src/server/api/admin/support/reply/POST.ts',
  'src/server/api/admin/support/stats/GET.ts',
  'src/server/api/admin/support/status/POST.ts',
] as const;

describe('administration support persistence', () => {
  it('routes case investigation and updates through PostgreSQL', () => {
    for (const file of databaseBackedRoutes) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('supportDatabaseStore.js');
      expect(source, file).not.toContain('supportStore.js');
    }
  });

  it('awaits every support mutation before acknowledging it', () => {
    const mutations = databaseBackedRoutes.slice(1);
    for (const file of mutations) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toMatch(/await (add|assign|bulk|query|get|update)/);
    }
  });
});
