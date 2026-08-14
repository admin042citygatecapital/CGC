import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');
}

describe('durable homepage publishing', () => {
  it('stores complete, fingerprinted publications in an append-only table', () => {
    const migration = source('src/server/db/migrations/0040_homepage_content_versions.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS homepage_content_versions');
    expect(migration).toContain("content_hash ~ '^[a-f0-9]{64}$'");
    expect(migration).toContain('content JSONB NOT NULL');
    expect(migration).toContain('updated_by TEXT NOT NULL');
    expect(migration).toContain('reason TEXT NOT NULL');
    expect(migration).not.toContain('UNIQUE (content_hash)');
    expect(migration).toContain('BEFORE UPDATE OR DELETE');
    expect(migration).toContain('homepage content versions are immutable');
  });

  it('serializes version allocation and fails closed without production PostgreSQL', () => {
    const store = source('src/server/lib/homepageCmsStore.ts');
    expect(store).toContain("pg_advisory_xact_lock(hashtext('homepage_content_versions'))");
    expect(store).toContain('SELECT COALESCE(MAX(version),0)::int AS version');
    expect(store).toContain('INSERT INTO homepage_content_versions');
    expect(store).toContain("process.env.NODE_ENV === 'production' && !isDatabaseConfigured()");
  });

  it('awaits reads and publication and records intent before the database change', () => {
    const publicRoute = source('src/server/api/cms/homepage/GET.ts');
    const adminReadRoute = source('src/server/api/admin/cms/homepage/GET.ts');
    const adminPublishRoute = source('src/server/api/admin/cms/homepage/POST.ts');
    expect(publicRoute).toContain('await readHomepageDocument()');
    expect(adminReadRoute).toContain('Promise.all([readHomepageDocument(), readHomepageHistory()])');
    expect(adminPublishRoute).toContain('await publishHomepageContent');
    expect(adminPublishRoute.indexOf('await appendCriticalAudit')).toBeLessThan(adminPublishRoute.indexOf('await publishHomepageContent'));
  });
});
