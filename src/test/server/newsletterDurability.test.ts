import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('durable newsletter operations', () => {
  it('stores campaigns and delivery logs in PostgreSQL', () => {
    const store = readFileSync('src/server/lib/campaignStore.ts', 'utf8');
    expect(store).toContain('INSERT INTO newsletter_campaigns');
    expect(store).toContain('INSERT INTO newsletter_delivery_log');
    expect(store).toContain('ensureLegacyMigrated');
    expect(store).toContain('isDatabaseConfigured()');
    expect(store).toContain("status NOT IN ('sent','sending') RETURNING *");
  });

  it('makes delivery records append-only', () => {
    const migration = readFileSync('src/server/db/migrations/0042_newsletter_campaigns.sql', 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS newsletter_campaigns');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS newsletter_delivery_log');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON newsletter_delivery_log');
  });

  it('awaits every production newsletter storage operation', () => {
    const files = [
      'src/server/api/admin/newsletter/campaigns/GET.ts',
      'src/server/api/admin/newsletter/campaigns/POST.ts',
      'src/server/api/admin/newsletter/campaigns/PUT.ts',
      'src/server/api/admin/newsletter/campaigns/duplicate/POST.ts',
      'src/server/api/admin/newsletter/campaigns/send/POST.ts',
      'src/server/api/admin/email/log/GET.ts',
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('await ');
      expect(source, file).not.toContain("json({ error: String(err) })");
    }
  });
});
