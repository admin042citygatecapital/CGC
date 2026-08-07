/**
 * applySchema2.ts — Apply migration 0002 (access_log, brute_force_lockouts).
 *
 * Usage:
 *   npx tsx src/server/db/applySchema2.ts
 */

import fs   from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';

const url = String(getSecret('DATABASE_URL') || process.env.DATABASE_URL || '').trim();
if (!url) { console.error('❌ DATABASE_URL not set'); process.exit(1); }

const sql = neon(url);

const schemaFile = path.join(import.meta.dirname, 'migrations', '0002_access_log_brute_force.sql');
const content    = fs.readFileSync(schemaFile, 'utf8');

// Split on semicolons, skip comments and empty statements
const statements = content
  .split(';')
  .map(s => s.replace(/--[^\n]*/g, '').trim())
  .filter(Boolean);

console.log(`Running ${statements.length} statements from 0002_access_log_brute_force.sql…`);

for (const stmt of statements) {
  try {
    await sql.unsafe(stmt);
    console.log('✓', stmt.slice(0, 60).replace(/\s+/g, ' '));
  } catch (err) {
    console.error('✗', stmt.slice(0, 60), '\n  Error:', err);
  }
}

console.log('Migration 0002 complete.');
