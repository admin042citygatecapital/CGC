/** Apply versioned SQL migrations to any standard PostgreSQL database. */

import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { getSecret } from '#airo/secrets';

const databaseUrl = String(
  getSecret('DATABASE_URL') ||
  getSecret('NEON_CONNECTION_STRING') ||
  getSecret('SUPABASE_DB_URL') ||
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
});

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
