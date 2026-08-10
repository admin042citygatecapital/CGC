import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIVE_PROVIDER_ADAPTERS_IMPLEMENTED } from '../../server/lib/platformMode.js';

const GUARDED_ADMIN_MUTATIONS = [
  'src/server/api/admin/balance/adjust/POST.ts',
  'src/server/api/admin/transactions/approve/POST.ts',
  'src/server/api/admin/transactions/create/POST.ts',
  'src/server/api/admin/wallets/PATCH.ts',
  'src/server/api/admin/users/create/POST.ts',
  'src/server/api/admin/users/edit/POST.ts',
] as const;

describe('production admin financial lock coverage', () => {
  it('guards every administrator path that can create balances, completed transactions or deposit identifiers', () => {
    for (const file of GUARDED_ADMIN_MUTATIONS) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain("import { requireFinancialOperations }");
      expect(source, file).toContain('requireFinancialOperations(res)');
    }
    expect(LIVE_PROVIDER_ADAPTERS_IMPLEMENTED).toBe(false);
  });

  it('does not render invented crypto holdings or deposit addresses in the admin workspace', () => {
    const source = readFileSync('src/pages/admin/crypto.tsx', 'utf8');
    expect(source).toContain('Crypto custody and trading are not enabled');
    expect(source).toContain('No amounts or addresses are represented');
    expect(source).not.toContain('platform custody wallets');
    expect(source).not.toMatch(/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh|0x742d35Cc6634C0532925a3b8D4C9C2B4E1A2F3D|TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE/);
  });

  it('keeps the crypto admin page inside the unsupported-claims scan', () => {
    const source = readFileSync('scripts/check-preview-claims.mjs', 'utf8');
    expect(source).toContain("'src/pages/admin/crypto.tsx'");
  });
});
