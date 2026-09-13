/** Apply versioned SQL migrations to any standard PostgreSQL database. */

import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { getSecret } from '#runtime/secrets';

const databaseUrl = String(
  getSecret('DATABASE_URL') ||
  process.env.DATABASE_URL ||
  ''
).trim();

if (!databaseUrl) {
  console.error('No database URL found. Set DATABASE_URL before running migrations.');
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
  prepare: false,
  ssl: resolveSsl(databaseUrl),
});

/**
 * Managed PostgreSQL providers (Supabase, Neon, Render) reject unencrypted
 * connections at pg_hba, and postgres.js only enables TLS when the URL carries
 * an sslmode parameter or an explicit ssl option. Require TLS for every host
 * that is not loopback, leaving an explicit sslmode in the URL authoritative.
 */
function resolveSsl(url: string): boolean | undefined {
  if (/sslmode=/.test(url)) return undefined;
  if (/localhost|127\.0\.0\.1|::1/.test(url)) return false;
  return true;
}

const migrationsDirectory = path.join(import.meta.dirname, 'migrations');

async function run(): Promise<void> {
  console.log('Connecting to PostgreSQL...');
  await sql`SELECT 1`;
  console.log('Connected.');

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = await sql<{ version: string }[]>`
    SELECT version FROM schema_migrations ORDER BY version
  `;
  const appliedVersions = new Set(applied.map(row => row.version));

  if (!fs.existsSync(migrationsDirectory)) {
    console.log('No migrations directory found.');
    return;
  }

  const pending = fs.readdirSync(migrationsDirectory)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .filter(file => !appliedVersions.has(path.basename(file, '.sql')));

  if (pending.length === 0) {
    console.log('No pending migrations. Database is up to date.');
    return;
  }

  console.log(`Applying ${pending.length} migration(s)...`);
  for (const file of pending) {
    const version = path.basename(file, '.sql');
    const migrationSql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');

    await sql.begin(async transaction => {
      await transaction.unsafe(migrationSql);
      await transaction`
        INSERT INTO schema_migrations (version)
        VALUES (${version})
        ON CONFLICT (version) DO NOTHING
      `;
    });
    console.log(`Applied ${file}.`);
  }

  console.log('All migrations applied successfully.');
}

run()
  .catch(error => {
    console.error('Migration failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
