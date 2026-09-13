/**
 * rollback.ts — Rollback the PostgreSQL migration.
 *
 * Usage:
 *   npx tsx src/server/db/rollback.ts [--confirm]
 *
 * Without --confirm, this script runs in dry-run mode and shows what would be dropped.
 * With --confirm, it drops all CGC tables and enums.
 *
 * ⚠ WARNING: This is DESTRUCTIVE. All data in PostgreSQL will be lost.
 * The flat-file stores in /private/ are NOT touched — they remain as backup.
 */

import postgres from 'postgres';
import { getSecret } from '#runtime/secrets';
import { resolveSsl } from './ssl.js';

const args    = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');

const url = String(getSecret('DATABASE_URL') || process.env.DATABASE_URL || '').trim();

if (!url) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

// Omit the ssl key when the URL governs TLS: an explicitly passed `undefined`
// would shadow the URL's sslmode and silently downgrade to plaintext.
const ssl = resolveSsl(url);
const sql = postgres(url, {
  max: 1,
  ...(ssl === undefined ? {} : { ssl }),
});

const TABLES = [
  'schema_migrations',
  'subscribers',
  'email_queue',
  'config',
  'audit_log',
  'login_events',
  'canned_responses',
  'support_notes',
  'support_messages',
  'support_conversations',
  'notifications',
  'trading_watchlist',
  'trading_trades',
  'trading_orders',
  'trading_positions',
  'kyc_settings',
  'kyc_notes',
  'wallets',
  'card_activity',
  'cards',
  'transactions',
  'customer_sessions',
  'admin_sessions',
  'users',
];

const ENUMS = [
  'account_tier', 'email_queue_status', 'login_result', 'login_actor',
  'support_status', 'support_priority', 'asset_class', 'position_status',
  'order_status', 'order_type', 'order_side', 'admin_role',
  'tx_currency', 'tx_status', 'tx_type', 'kyc_status', 'user_status',
];

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  City Gate Capital — PostgreSQL Rollback');
  console.log(`  Mode: ${CONFIRM ? '💥 DESTRUCTIVE — dropping all tables' : '🔍 DRY RUN — no changes'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!CONFIRM) {
    console.log('The following tables would be dropped (CASCADE):\n');
    TABLES.forEach(t => console.log(`  DROP TABLE IF EXISTS ${t} CASCADE`));
    console.log('\nThe following enums would be dropped:\n');
    ENUMS.forEach(e => console.log(`  DROP TYPE IF EXISTS ${e} CASCADE`));
    console.log('\n⚠ To execute the rollback, run with --confirm:');
    console.log('  npx tsx src/server/db/rollback.ts --confirm\n');
    await sql.end();
    return;
  }

  console.log('🔌 Connecting to database...');
  try {
    await sql`SELECT 1`;
    console.log('✅ Connected\n');
  } catch (err) {
    console.error('❌ Connection failed:', err);
    await sql.end();
    process.exit(1);
  }

  console.log('Dropping tables...');
  for (const table of TABLES) {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`  ✅ Dropped: ${table}`);
    } catch (err) {
      console.error(`  ❌ Failed to drop ${table}:`, err);
    }
  }

  console.log('\nDropping enums...');
  for (const enumName of ENUMS) {
    try {
      await sql.unsafe(`DROP TYPE IF EXISTS ${enumName} CASCADE`);
      console.log(`  ✅ Dropped: ${enumName}`);
    } catch (err) {
      console.error(`  ❌ Failed to drop ${enumName}:`, err);
    }
  }

  console.log('\n✅ Rollback complete. All CGC tables and enums have been dropped.');
  console.log('   Flat-file stores in /private/ are untouched and can be used to re-migrate.\n');

  await sql.end();
}

run().catch(async (err) => {
  console.error('Fatal error:', err);
  await sql.end();
  process.exit(1);
});
