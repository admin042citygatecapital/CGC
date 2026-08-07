/**
 * applySchemaFetch.ts — Apply schema using Neon's HTTP API directly.
 *
 * The pooler URL doesn't support DDL via sql.unsafe().
 * This script converts the pooler URL to a direct URL and uses
 * the Neon HTTP API to execute DDL statements.
 *
 * Pooler URL:  postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db
 * Direct URL:  postgresql://user:pass@ep-xxx.region.aws.neon.tech/db
 */

import fs   from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';

const poolerUrl = String(getSecret('DATABASE_URL') || process.env.DATABASE_URL || '').trim();
if (!poolerUrl) { console.error('❌ DATABASE_URL not set'); process.exit(1); }

// Convert pooler URL to direct URL for DDL
const directUrl = poolerUrl.replace(/-pooler\./, '.');
console.log('Using direct URL for DDL (no pooler)');

const sql = neon(directUrl);

// Test connection
await sql`SELECT 1`;
console.log('✅ Connected via direct URL\n');

const schemaFile = path.join(import.meta.dirname, 'migrations', '0001_initial_schema.sql');
const content    = fs.readFileSync(schemaFile, 'utf8');

// Parse statements line by line, tracking dollar-quote depth
const lines = content.split('\n');
const statements: string[] = [];
let current: string[] = [];
let inDollar = false;

for (const line of lines) {
  const trimmed = line.trim();

  // Count $$ occurrences to track dollar-quote depth
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

console.log(`📋 Applying ${statements.length} statements via direct connection...\n`);

let applied = 0, skipped = 0, errors = 0;

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.slice(0, 70).replace(/\n/g, ' ').trim();

  try {
    await sql`${sql.unsafe(stmt)}`;
    applied++;
    if (i < 5 || i >= statements.length - 3 || i % 15 === 0) {
      console.log(`  ✅ [${i+1}/${statements.length}] ${preview}`);
    }
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('already exists') || msg.includes('duplicate_object') || msg.includes('duplicate column')) {
      skipped++;
    } else {
      errors++;
      console.error(`  ❌ [${i+1}/${statements.length}] ${preview}`);
      console.error(`     ${msg.split('\n')[0]}`);
    }
  }
}

console.log(`\nApplied: ${applied}, Skipped: ${skipped}, Errors: ${errors}`);

// Verify
const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
console.log(`\nTables: ${tables.map((r: Record<string, unknown>) => r.tablename).join(', ')}`);

if (errors > 0) process.exit(1);
console.log('\n✅ Schema applied successfully via direct connection.');
