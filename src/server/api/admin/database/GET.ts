import { getDatabaseEvidence } from '../../../lib/databaseEvidence.js';
import type { Request, Response } from 'express';
import { getSecret } from '#runtime/secrets';
import { getQueryClient, isDatabaseConfigured, testConnection } from '../../../db/db.js';

interface DatabaseOperationsRow {
  tableCount: number;
  rlsEnabledTables: number;
  migrationCount: number;
  latestMigration: string | null;
  latestMigrationAt: Date | string | null;
}

export default async function handler(_req: Request, res: Response) {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'PostgreSQL is not configured.', code: 'DATABASE_NOT_CONFIGURED' });
  }

  const connection = await testConnection();
  if (!connection.ok) {
    return res.status(503).json({
      error: 'PostgreSQL health check failed.',
      code: 'DATABASE_UNAVAILABLE',
      database: { state: 'error', latencyMs: connection.latencyMs ?? null },
    });
  }

  try {
    const rows = await getQueryClient()<DatabaseOperationsRow[]>`
      SELECT
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS "tableCount",
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true) AS "rlsEnabledTables",
        (SELECT count(*)::int FROM schema_migrations) AS "migrationCount",
        (SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1) AS "latestMigration",
        (SELECT applied_at FROM schema_migrations ORDER BY version DESC LIMIT 1) AS "latestMigrationAt"
    `;
    const summary = rows[0];
    const storageConfigured = Boolean(
      getSecret('SUPABASE_URL') && getSecret('SUPABASE_SERVICE_ROLE_KEY') && getSecret('SUPABASE_STORAGE_BUCKET')
    );
    return res.json({
      evidence: getDatabaseEvidence(),
      database: { state: 'healthy', provider: 'PostgreSQL', latencyMs: connection.latencyMs ?? null },
      schema: {
        tableCount: summary?.tableCount ?? 0,
        rlsEnabledTables: summary?.rlsEnabledTables ?? 0,
        migrationCount: summary?.migrationCount ?? 0,
        latestMigration: summary?.latestMigration ?? null,
        latestMigrationAt: summary?.latestMigrationAt ? new Date(summary.latestMigrationAt).toISOString() : null,
      },
      storage: { state: storageConfigured ? 'configured' : 'not_configured', privateCredentials: storageConfigured },
      controls: {
        arbitrarySql: false,
        schemaChanges: 'source-controlled migrations only',
        secretValuesExposed: false,
      },
    });
  } catch {
    return res.status(503).json({ error: 'Database operational metadata is unavailable.', code: 'DATABASE_METADATA_UNAVAILABLE' });
  }
}
