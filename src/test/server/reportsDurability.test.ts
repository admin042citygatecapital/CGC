import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('administration report durability', () => {
  it('uses PostgreSQL-backed email and login repositories instead of legacy report files', () => {
    const store = fs.readFileSync(path.resolve(process.cwd(), 'src/server/lib/reportsStore.ts'), 'utf8');
    const route = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/admin/reports/GET.ts'), 'utf8');

    expect(store).toContain("from './campaignStore.js'");
    expect(store).toContain("from './emailQueue.js'");
    expect(store).toContain("from './loginLog.js'");
    expect(store).not.toContain("privateSubdirectory('email/email-log.jsonl')");
    expect(store).not.toContain("privateSubdirectory('security/login-log.jsonl')");
    expect(route).toContain('await emailsReport(q)');
    expect(route).toContain('await securityReport(q)');
    expect(store).toContain('isOperationalCustomer');
    expect(store).toContain('operationalTransactions');
  });
});
