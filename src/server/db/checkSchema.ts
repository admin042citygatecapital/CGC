import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';

const sql = neon(String(getSecret('DATABASE_URL') || ''));

// Try to create a simple test table directly
try {
  await sql`CREATE TABLE IF NOT EXISTS _test_table (id SERIAL PRIMARY KEY, val TEXT)`;
  console.log('✅ Direct CREATE TABLE works');
  await sql`DROP TABLE _test_table`;
  console.log('✅ DROP TABLE works');
} catch (err) {
  console.error('❌ Direct DDL failed:', err);
}

// Check what tables exist
const rows = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
console.log('\nAll tables:', rows.map((r: Record<string, unknown>) => r.tablename).join(', '));

// Try unsafe
try {
  await sql.unsafe('CREATE TABLE IF NOT EXISTS _test2 (id SERIAL PRIMARY KEY)');
  console.log('✅ sql.unsafe DDL works');
  await sql.unsafe('DROP TABLE _test2');
} catch (err) {
  console.error('❌ sql.unsafe DDL failed:', err);
}
