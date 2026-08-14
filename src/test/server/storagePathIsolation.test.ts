import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ISOLATED_RUNTIME_FILES = [
  'src/server/lib/userStore.flatfile.ts',
  'src/server/lib/sessionStore.flatfile.ts',
  'src/server/lib/auditLog.flatfile.ts',
  'src/server/lib/loginLog.flatfile.ts',
  'src/server/lib/transactionStore.flatfile.ts',
  'src/server/lib/supportStore.ts',
  'src/server/lib/ratesStore.ts',
  'src/server/lib/tradingAdminStore.ts',
] as const;

describe('runtime storage isolation', () => {
  it('routes browser-test and smoke-test state through configurable storage roots', () => {
    for (const file of ISOLATED_RUNTIME_FILES) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toMatch(/privateSubdirectory|privateDataRoot/);
      expect(source, file).not.toMatch(/['"]\/private\//);
    }
  });

  it('keeps generated browser artifacts out of source control', () => {
    const gitignore = readFileSync('.gitignore', 'utf8');
    expect(gitignore).toContain('playwright-report/');
    expect(gitignore).toContain('test-results/');
  });
});
