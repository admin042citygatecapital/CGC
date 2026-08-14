import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('withdrawal usage durability', () => {
  it('uses the authoritative transaction repository and awaits usage before enforcing limits', () => {
    const ratesStore = fs.readFileSync(path.resolve(process.cwd(), 'src/server/lib/ratesStore.ts'), 'utf8');
    const withdrawalRoute = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/users/withdraw/POST.ts'), 'utf8');
    const adminRoute = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/admin/rates/limits/user/GET.ts'), 'utf8');

    expect(ratesStore).toContain("await import('./transactionStore.js')");
    expect(ratesStore).toContain('getWithdrawalTransactionsSince');
    expect(ratesStore).not.toContain("privateSubdirectory('transactions')");
    expect(ratesStore).not.toContain('return { todayUSD: 0, monthUSD: 0 }; }');
    expect(withdrawalRoute).toContain('await getWithdrawalUsage(user.id)');
    expect(adminRoute).toContain('await getWithdrawalUsage(user.id)');
    expect(adminRoute).toContain('await getWithdrawalUsage(userId)');
  });
});
