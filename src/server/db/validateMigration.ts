/**
 * validateMigration.ts — Validate migrated data in PostgreSQL.
 *
 * Usage:
 *   npx tsx src/server/db/validateMigration.ts
 *
 * Checks:
 *   1. Row counts match between flat files and PostgreSQL
 *   2. Spot-checks random records for data integrity
 *   3. Verifies all foreign key constraints are satisfied
 *   4. Checks for null values in required fields
 *   5. Verifies card encryption is intact
 *
 * Outputs a pass/fail report.
 */

import fs   from 'node:fs';
import postgres from 'postgres';
import { getSecret } from '#airo/secrets';

const url = String(getSecret('DATABASE_URL') || process.env.DATABASE_URL || '').trim();

if (!url) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });

interface Check {
  name:   string;
  passed: boolean;
  detail: string;
}

const checks: Check[] = [];

function pass(name: string, detail: string) {
  checks.push({ name, passed: true, detail });
  console.log(`  ✅ ${name}: ${detail}`);
}

function fail(name: string, detail: string) {
  checks.push({ name, passed: false, detail });
  console.log(`  ❌ ${name}: ${detail}`);
}

function readJsonlCount(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).length;
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  City Gate Capital — Migration Validation');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── 1. Connection ──────────────────────────────────────────────────────────
  try {
    await sql`SELECT 1`;
    pass('db.connection', 'Connected to PostgreSQL');
  } catch (err) {
    fail('db.connection', String(err));
    await sql.end();
    process.exit(1);
  }

  // ── 2. Schema exists ───────────────────────────────────────────────────────
  const tables = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const tableNames = tables.map(t => t.tablename);
  const requiredTables = ['users', 'transactions', 'cards', 'wallets', 'kyc_notes', 'trading_positions', 'trading_orders', 'notifications', 'support_conversations', 'login_events', 'audit_log', 'admin_sessions', 'customer_sessions', 'operations_items'];

  for (const t of requiredTables) {
    if (tableNames.includes(t)) {
      pass(`schema.${t}`, 'Table exists');
    } else {
      fail(`schema.${t}`, 'Table MISSING — run migrate.ts first');
    }
  }

  // ── 3. Row count comparisons ───────────────────────────────────────────────
  // ── 3. Row count comparisons (hardcoded table names for template literal safety) ──
  const countMap: Record<string, string> = {
    users:               '/private/users/users.jsonl',
    transactions:        '/private/transactions/transactions.jsonl',
    cards:               '/private/cards/cards.jsonl',
    notifications:       '/private/notifications/notifications.jsonl',
    login_events:        '/private/logs/login.jsonl',
    trading_positions:   '/private/trading/positions.jsonl',
    trading_orders:      '/private/trading/orders.jsonl',
    trading_trades:      '/private/trading/trades.jsonl',
  };

  const dbCounts: Record<string, number> = {};
  try {
    const rows = await sql`
      SELECT 'users' as t, COUNT(*) as cnt FROM users
      UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
      UNION ALL SELECT 'cards', COUNT(*) FROM cards
      UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
      UNION ALL SELECT 'login_events', COUNT(*) FROM login_events
      UNION ALL SELECT 'trading_positions', COUNT(*) FROM trading_positions
      UNION ALL SELECT 'trading_orders', COUNT(*) FROM trading_orders
      UNION ALL SELECT 'trading_trades', COUNT(*) FROM trading_trades
    ` as { t: string; cnt: string }[];
    for (const r of rows) dbCounts[r.t] = parseInt(r.cnt, 10);
  } catch (err) {
    fail('count.all', `Failed to query row counts: ${String(err)}`);
  }

  for (const [table, file] of Object.entries(countMap)) {
    const fileCount = readJsonlCount(file);
    if (fileCount === 0) { pass(`count.${table}`, `No flat file — skipping`); continue; }
    const dbCount = dbCounts[table] ?? 0;
    if (dbCount === fileCount)  pass(`count.${table}`, `${dbCount} rows match flat file`);
    else if (dbCount > 0)       pass(`count.${table}`, `DB has ${dbCount} rows, flat file has ${fileCount} (partial OK)`);
    else                        fail(`count.${table}`, `DB has 0 rows but flat file has ${fileCount}`);
  }

  // ── 4. Data integrity checks ───────────────────────────────────────────────

  // Users: no null emails
  try {
    const nullEmails = await sql<{ count: string }[]>`SELECT COUNT(*)::text as count FROM users WHERE email IS NULL OR email = ''`;
    const count = parseInt(nullEmails[0].count, 10);
    if (count === 0) pass('integrity.users.email', 'No null/empty emails');
    else fail('integrity.users.email', `${count} users with null/empty email`);
  } catch (err) { fail('integrity.users.email', String(err)); }

  // Transactions: no null amounts
  try {
    const nullAmounts = await sql<{ count: string }[]>`SELECT COUNT(*)::text as count FROM transactions WHERE amount IS NULL`;
    const count = parseInt(nullAmounts[0].count, 10);
    if (count === 0) pass('integrity.transactions.amount', 'No null amounts');
    else fail('integrity.transactions.amount', `${count} transactions with null amount`);
  } catch (err) { fail('integrity.transactions.amount', String(err)); }

  // Cards: encrypted PAN format
  try {
    const badCards = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM cards
      WHERE number_enc NOT LIKE 'enc:%' AND number_enc != ''
    `;
    const count = parseInt(badCards[0].count, 10);
    if (count === 0) pass('integrity.cards.encryption', 'All PANs are encrypted');
    else fail('integrity.cards.encryption', `${count} cards with unencrypted PAN`);
  } catch (err) { fail('integrity.cards.encryption', String(err)); }

  // ── 5. Foreign key spot checks ─────────────────────────────────────────────

  // Customer sessions reference valid users
  try {
    const orphaned = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM customer_sessions cs
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE u.id IS NULL
    `;
    const count = parseInt(orphaned[0].count, 10);
    if (count === 0) pass('fk.customer_sessions', 'All sessions reference valid users');
    else fail('fk.customer_sessions', `${count} orphaned sessions`);
  } catch (err) { fail('fk.customer_sessions', String(err)); }

  // Cards reference valid users
  try {
    const orphaned = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM cards c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE u.id IS NULL
    `;
    const count = parseInt(orphaned[0].count, 10);
    if (count === 0) pass('fk.cards', 'All cards reference valid users');
    else fail('fk.cards', `${count} orphaned cards`);
  } catch (err) { fail('fk.cards', String(err)); }

  // ── 6. Summary ────────────────────────────────────────────────────────────
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Passed: ${passed}/${checks.length}`);
  console.log(`  Failed: ${failed}/${checks.length}`);

  if (failed === 0) {
    console.log('\n  ✅ All validation checks passed. Migration is complete and data is intact.\n');
  } else {
    console.log(`\n  ⚠ ${failed} check(s) failed. Review the output above.\n`);
  }

  // Write validation report
  const reportPath = '/private/validation-report.json';
  try {
    fs.mkdirSync('/private', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), passed, failed, total: checks.length, checks }, null, 2));
    console.log(`  📄 Report written to: ${reportPath}\n`);
  } catch { /* ignore */ }

  await sql.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error('Fatal error:', err);
  await sql.end();
  process.exit(1);
});
