import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('customer goals boundary', () => {
  it('derives ownership from the authenticated customer for every read and write', () => {
    const get = read('src/server/api/users/goals/GET.ts');
    const post = read('src/server/api/users/goals/POST.ts');
    expect(get).toContain('req.customerUser');
    expect(get).toContain('WHERE user_id = ${customer.id}');
    expect(post).toContain('req.customerUser');
    expect(post).toContain('AND user_id = ${customer.id}');
    expect(post).not.toContain('req.body?.userId');
  });

  it('keeps goal tracking separate from ledger and transaction tables', () => {
    const migration = read('src/server/db/migrations/0036_customer_goals.sql');
    const post = read('src/server/api/users/goals/POST.ts');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS customer_goals');
    expect(migration).not.toContain('journal_');
    expect(post).not.toMatch(/journal|transaction|balance/i);
  });

  it('registers authenticated routes and an authenticated customer page', () => {
    const entry = read('src/server/entry.ts');
    const routes = read('src/routes.tsx');
    expect(entry).toContain('app.get("/api/users/goals"');
    expect(entry).toContain('app.post("/api/users/goals"');
    expect(routes).toContain("path: '/dashboard/goals'");
    expect(routes).toContain('<CustomerOnly><DashboardGoals /></CustomerOnly>');
  });
});
