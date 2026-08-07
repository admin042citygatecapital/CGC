import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';
const sql = neon(String(getSecret('DATABASE_URL') || ''));
const rows = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
console.log('Tables in database:');
console.log(rows.map((r: Record<string, unknown>) => '  ' + r.tablename).join('\n') || '  (none)');
