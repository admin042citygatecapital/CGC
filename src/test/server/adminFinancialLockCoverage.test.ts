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

  it('serves persistent transaction records instead of randomly generated financial activity', () => {
    const route = readFileSync('src/server/api/admin/transactions/GET.ts', 'utf8');
    expect(route).toContain('queryTransactions');
    expect(route).toContain("dataClassification: 'synthetic_preview'");
    expect(route).not.toContain('Math.random');
    expect(route).not.toContain('seed(500)');

    const page = readFileSync('src/pages/admin/transactions.tsx', 'utf8');
    expect(page).toContain('Persistent demonstration register');
    expect(page).toContain('This screen is read-only');
    expect(page).not.toContain('/api/admin/transactions/create');
    expect(page).not.toContain('Create Transaction');
  });

  it('does not present preview crypto holdings or deposits as revenue on the executive dashboard', () => {
    const page = readFileSync('src/pages/admin/index.tsx', 'utf8');
    expect(page).toContain('Pre-deployment administration');
    expect(page).toContain('Pre-deployment financial boundary');
    expect(page).not.toContain('Crypto Market');
    expect(page).not.toContain('AUM:');

    const route = readFileSync('src/server/api/admin/stats/GET.ts', 'utf8');
    expect(route).toContain(".filter(t => t.type === 'fee')");
    expect(route).toContain("dataClassification: 'synthetic_preview'");
    expect(route).not.toContain('cryptoBalances');
    expect(route).not.toContain('cryptoAUM');
  });

  it('forces market and provider planning records disabled in preview and prevents activation', () => {
    for (const file of [
      'src/server/api/admin/trading/providers/GET.ts',
      'src/server/api/admin/trading/markets/GET.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('isPreviewMode');
      expect(source, file).toContain("status: 'disabled'");
      expect(source, file).toContain('dataClassification');
    }
    for (const file of [
      'src/server/api/admin/trading/providers/PUT.ts',
      'src/server/api/admin/trading/markets/PUT.ts',
      'src/server/api/admin/trading/markets/suspend/POST.ts',
      'src/server/api/admin/trading/freeze/POST.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('requirePaperTrading');
    }
    const page = readFileSync('src/pages/admin/trading.tsx', 'utf8');
    expect(page).toContain('Planning workspace only');
    expect(page).toContain('No execution venue, custody provider or live trading adapter is connected');
  });

  it('does not claim media optimization without a transformation pipeline', () => {
    const postRoute = readFileSync('src/server/api/admin/media/POST.ts', 'utf8');
    expect(postRoute).toContain('OPTIMIZER_NOT_CONFIGURED');
    expect(postRoute).not.toContain('Math.random');
    expect(postRoute).not.toContain('markOptimized');

    const getRoute = readFileSync('src/server/api/admin/media/GET.ts', 'utf8');
    expect(getRoute).toContain('optimizerConfigured: false');
    const page = readFileSync('src/pages/admin/media.tsx', 'utf8');
    expect(page).toContain('MEDIA_OPTIMIZATION_CONFIGURED = false');
  });
});
