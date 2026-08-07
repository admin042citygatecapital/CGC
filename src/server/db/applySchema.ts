/**
 * applySchema.ts — Apply the full schema SQL to Neon via HTTP driver.
 *
 * Splits the SQL file into individual statements correctly (handles
 * dollar-quoted blocks like DO $$ ... $$) and runs each via neon().unsafe().
 *
 * Usage:
 *   npx tsx src/server/db/applySchema.ts
 */

import fs   from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';

const url = String(getSecret('DATABASE_URL') || process.env.DATABASE_URL || '').trim();
if (!url) { console.error('❌ DATABASE_URL not set'); process.exit(1); }

const sql = neon(url);

const schemaFile = path.join(import.meta.dirname, 'migrations', '0001_initial_schema.sql');
const content    = fs.readFileSync(schemaFile, 'utf8');

/**
 * Split SQL into individual statements, respecting:
 *  - Dollar-quoted blocks: $$ ... $$ and $body$ ... $body$
 *  - Standard semicolons
 *  - Comments
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;

  while (i < sql.length) {
    // Check for dollar-quote start/end
    if (!inDollarQuote) {
      const dollarMatch = sql.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (dollarMatch) {
        dollarTag = dollarMatch[0];
        inDollarQuote = true;
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    } else {
      if (sql.slice(i).startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length;
        inDollarQuote = false;
        dollarTag = '';
        continue;
      }
    }

    const ch = sql[i];

    if (!inDollarQuote && ch === ';') {
      const stmt = current.trim();
      if (stmt && !stmt.startsWith('--')) {
        statements.push(stmt);
      }
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  // Remaining content
  const last = current.trim();
  if (last && !last.startsWith('--')) statements.push(last);

  return statements.filter(s => s.length > 0);
}

async function run() {
  console.log('🔌 Connecting to Neon...');
  await sql`SELECT 1`;
  console.log('✅ Connected\n');

  const statements = splitStatements(content);
  console.log(`📋 Applying ${statements.length} SQL statements...\n`);

  let applied = 0;
  let skipped = 0;
  let errors  = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 60).replace(/\n/g, ' ');

    try {
      await sql.unsafe(stmt);
      applied++;
      if (i % 10 === 0 || i === statements.length - 1) {
        process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}...\n`);
      }
    } catch (err: unknown) {
      const msg = String(err);
      // Ignore "already exists" errors — schema is idempotent
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate_object') ||
        msg.includes('duplicate column')
      ) {
        skipped++;
      } else {
        errors++;
        console.error(`  ❌ [${i + 1}] ${preview}`);
        console.error(`     ${msg.split('\n')[0]}`);
      }
    }
  }

  console.log(`\n  Applied: ${applied}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  if (errors === 0) {
    console.log('\n✅ Schema applied successfully.');
  } else {
    console.log(`\n⚠ Schema applied with ${errors} error(s).`);
    process.exit(1);
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
