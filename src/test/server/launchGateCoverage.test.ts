import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const financialRoutes = [
  'src/server/api/users/deposit/POST.ts',
  'src/server/api/users/withdraw/POST.ts',
  'src/server/api/users/transfer/POST.ts',
  'src/server/api/users/transfers/POST.ts',
  'src/server/api/users/swap/POST.ts',
];

const cardMutationRoutes = [
  'src/server/api/users/cards/generate/POST.ts',
  'src/server/api/users/cards/request/POST.ts',
  'src/server/api/users/cards/freeze/POST.ts',
  'src/server/api/users/cards/delete/POST.ts',
  'src/server/api/admin/cards/issue/POST.ts',
  'src/server/api/admin/cards/replace/POST.ts',
  'src/server/api/admin/cards/freeze/POST.ts',
  'src/server/api/admin/cards/pin/POST.ts',
  'src/server/api/admin/cards/spending-limit/POST.ts',
];

describe('financial launch-gate coverage', () => {
  it.each(financialRoutes)('%s requires verified financial readiness', (file) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    expect(source).toContain('requireFinancialOperations');
    expect(source).toMatch(/if \(!requireFinancialOperations\(res\)\) return;/);
  });

  it('keeps order placement behind the paper-trading gate', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/server/api/users/trading/orders/POST.ts'),
      'utf8',
    );
    expect(source).toContain('requirePaperTrading');
    expect(source).toMatch(/if \(!requirePaperTrading\(res\)\) return;/);
  });

  it.each(cardMutationRoutes)('%s requires the dedicated issuer-adapter gate', (file) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    expect(source).toContain('requireCardOperations');
    expect(source).toMatch(/if \(!requireCardOperations\(res\)\) return;/);
    expect(source).not.toMatch(/createCard|updateCard|deleteCard|randomInt|genCardNumber/);
  });
});
