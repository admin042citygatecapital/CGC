import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';

const url = String(getSecret('DATABASE_URL') || '');
console.log('URL type:', url.includes('-pooler.') ? 'POOLER' : 'DIRECT');
console.log('URL prefix:', url.slice(0, 50) + '...');

const sql = neon(url);

// Check current database and user
const info = await sql`SELECT current_database(), current_user, version()`;
console.log('\nDB info:', info[0]);

// Check if we can see the tables we just created
const tables = await sql`
  SELECT tablename, tableowner 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY tablename
`;
console.log('\nAll public tables:');
tables.forEach((r: Record<string, unknown>) => console.log(`  ${r.tablename} (owner: ${r.tableowner})`));

// Try creating a table and immediately checking it
await sql.unsafe(`CREATE TABLE IF NOT EXISTS _debug_test (id SERIAL PRIMARY KEY, val TEXT)`);
const check = await sql`SELECT tablename FROM pg_tables WHERE tablename = '_debug_test'`;
console.log('\n_debug_test exists after create:', check.length > 0 ? 'YES' : 'NO');
if (check.length > 0) {
  await sql.unsafe(`DROP TABLE _debug_test`);
}
