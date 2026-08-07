import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';

const sql = neon(String(getSecret('DATABASE_URL') || ''));

// Test dollar-quoted block
try {
  await sql.unsafe(`DO $$ BEGIN
  CREATE TYPE test_enum AS ENUM ('a', 'b', 'c');
EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  console.log('✅ Dollar-quoted DO block works');
  await sql.unsafe(`DROP TYPE IF EXISTS test_enum`);
} catch (err) {
  console.error('❌ Dollar-quoted DO block failed:', err);
}

// Test CREATE EXTENSION
try {
  await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  console.log('✅ CREATE EXTENSION works');
} catch (err) {
  console.error('❌ CREATE EXTENSION failed:', err);
}

// Test a full table create
try {
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS _test_full (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  console.log('✅ Full CREATE TABLE works');
  await sql.unsafe(`DROP TABLE _test_full`);
} catch (err) {
  console.error('❌ Full CREATE TABLE failed:', err);
}
