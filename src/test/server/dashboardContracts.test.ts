import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

/**
 * Phase 1 dashboard UI contracts (Bugs 2–4).
 *
 * These are source contracts (not jsdom renders): they pin the exact bindings
 * the bug report calls out so a regression reintroduces a failing test.
 */
describe('Phase 1 dashboard UI contracts (Bugs 2–4)', () => {
  it('renders the hero balance in the detected primary currency, not hardcoded USD (Bug 2)', () => {
    const dashboard = read('src/pages/dashboard.tsx');
    // Hero number formats primaryAmount in primaryCurrency …
    expect(dashboard).toMatch(/fmtCurrency\(\s*primaryBalance\s*,\s*primaryCurrency\s*\)/);
    // … the currency code is labelled next to it …
    expect(dashboard).toMatch(/\{primaryCurrency\}/);
    // … and a non-USD equivalent line is shown instead of implying USD.
    expect(dashboard).toMatch(/USD equivalent/);
  });

  it('binds the portfolio bar and wallet rows to live balance data (Bug 2)', () => {
    const dashboard = read('src/pages/dashboard.tsx');
    // PortfolioBar receives the live currency list + USD total …
    expect(dashboard).toMatch(/<PortfolioBar\s+currencies=\{balanceData!\.currencies\}\s+totalUsd=\{totalUsd\}/);
    // … wallet rows map over the live list with per-currency formatting …
    expect(dashboard).toMatch(/balanceData\?\.currencies \?\? \[\]\)\.slice\(0, 8\)\.map/);
    expect(dashboard).toMatch(/fmtCurrency\(\s*c\.amount\s*,\s*c\.currency\s*\)/);
    // … no demo wallet dataset feeds the dashboard.
    expect(dashboard).not.toMatch(/DEMO_WALLETS/);
  });

  it('binds the analytics spending chart to real aggregated transaction data (Bug 3)', () => {
    const analytics = read('src/pages/dashboard/analytics.tsx');
    // Monthly bars aggregate filteredTx by month …
    expect(analytics).toMatch(/filteredTx/);
    expect(analytics).toMatch(/monthlyData/);
    // … the donut aggregates by spend type …
    expect(analytics).toMatch(/spendByType/);
    // … and the empty state only renders when the filtered list is empty.
    expect(analytics).toMatch(/filteredTx\.length === 0/);
    // No static demo dataset may feed the chart.
    expect(analytics).not.toMatch(/const\s+(demo|static|sample)(Spend|Monthly|Chart)/i);
  });

  it('wires the wallet exchange widget to POST /api/users/swap with validation + errors (Bug 4)', () => {
    const wallet = read('src/pages/wallet.tsx');
    expect(wallet).toContain('/api/users/swap');
    expect(wallet).toContain('Idempotency-Key');
    expect(wallet).toMatch(/newIdempotencyKey\(\)/);
    // Amount + authentication validation before execution …
    expect(wallet).toMatch(/Enter a valid amount/);
    expect(wallet).toMatch(/Log In to Exchange/);
    // … loading, success, and error states.
    expect(wallet).toMatch(/swapLoading/);
    expect(wallet).toMatch(/swapSuccess/);
    expect(wallet).toMatch(/swapError/);
  });

  it('renders indicative-rate rows without clipped/truncated single-line layouts (Bug 4 styling)', () => {
    const wallet = read('src/pages/wallet.tsx');
    // The marketing rate pills wrap instead of clipping BTC/USD + ETH/EUR rows.
    expect(wallet).toMatch(/flex-wrap/);
    // No single-line truncation class anywhere in the widget.
    expect(wallet).not.toContain('truncate');
  });

  it('marks the dashboard exchange converter reference-only until execution is live (Bug 4 honesty)', () => {
    const rates = read('src/pages/dashboard/rates.tsx');
    expect(rates).toMatch(/indicative/i);
    expect(rates).toMatch(/execution is currently unavailable/i);
  });
});
