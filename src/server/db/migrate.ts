/**
 * migrate.ts — Apply schema to Neon via HTTP driver (direct URL for DDL).
 *
 * Usage:
 *   npx tsx src/server/db/migrate.ts
 */

import fs   from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';

// Accept DATABASE_URL (Neon pooler), NEON_CONNECTION_STRING (legacy alias),
// or SUPABASE_DB_URL (Supabase Postgres — same PostgreSQL wire protocol).
const poolerUrl = String(
  getSecret('DATABASE_URL') ||
  getSecret('NEON_CONNECTION_STRING') ||
  getSecret('SUPABASE_DB_URL') ||
  process.env.DATABASE_URL ||
  ''
).trim();
if (!poolerUrl) {
  console.error('❌ No database URL found. Set DATABASE_URL, NEON_CONNECTION_STRING, or SUPABASE_DB_URL.');
  process.exit(1);
}

// For Neon: DDL requires direct (non-pooler) connection — strip "-pooler" from hostname.
// For Supabase: the connection string is already direct; the replace is a no-op.
const directUrl = poolerUrl.replace(/-pooler\./, '.');
const sql = neon(directUrl);

const MIGRATIONS_DIR = path.join(import.meta.dirname, 'migrations');

function splitStatements(content: string): string[] {
  const lines = content.split('\n');
  const statements: string[] = [];
  let current: string[] = [];
  let inDollar = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const ddCount = (line.match(/\$\$/g) ?? []).length;
    if (ddCount % 2 !== 0) inDollar = !inDollar;

    if (!inDollar && trimmed === '' && current.length === 0) continue;
    if (!inDollar && trimmed.startsWith('--') && current.length === 0) continue;

    current.push(line);

    if (!inDollar && trimmed.endsWith(';')) {
      const stmt = current.join('\n').trim().replace(/;$/, '');
      if (stmt && !stmt.startsWith('--')) statements.push(stmt);
      current = [];
    }
  }
  if (current.length > 0) {
    const stmt = current.join('\n').trim().replace(/;$/, '');
    if (stmt && !stmt.startsWith('--')) statements.push(stmt);
  }
  return statements;
}

async function run() {
  console.log('🔌 Connecting to Neon (direct URL for DDL)...');
  await sql`SELECT 1`;
  console.log('✅ Connected\n');

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied    = await sql`SELECT version FROM schema_migrations ORDER BY version` as Array<{ version: string }>;
  const appliedSet = new Set(applied.map(r => r.version));

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('⚠  No migrations directory found.');
    return;
  }

  const files   = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  const pending = files.filter(f => !appliedSet.has(path.basename(f, '.sql')));

  if (pending.length === 0) {
    console.log('✅ No pending migrations. Database is up to date.');
    return;
  }

  console.log(`📋 Found ${pending.length} pending migration(s):\n`);

  for (const file of pending) {
    const version  = path.basename(file, '.sql');
    const content  = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const stmts    = splitStatements(content);

    console.log(`  ▶ Running: ${file} (${stmts.length} statements)`);
    const start = Date.now();
    let errors  = 0;

    for (const stmt of stmts) {
      try {
        await sql`${sql.unsafe(stmt)}`;
      } catch (err: unknown) {
        const msg = String(err);
        if (!msg.includes('already exists') && !msg.includes('duplicate_object')) {
          errors++;
          console.error(`    ❌ ${stmt.slice(0, 60)}: ${msg.split('\n')[0]}`);
        }
      }
    }

    if (errors === 0) {
      await sql`INSERT INTO schema_migrations (version) VALUES (${version}) ON CONFLICT (version) DO NOTHING`;
      console.log(`  ✅ Done in ${Date.now() - start}ms\n`);
    } else {
      console.error(`  ❌ Failed with ${errors} error(s)\n`);
      process.exit(1);
    }
  }

  console.log('✅ All migrations applied successfully.');
}

run().catch(err => { console.error('Fatal error:', err); process.exit(1); });
