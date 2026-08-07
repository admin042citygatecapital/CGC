import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';
const poolerUrl = String(getSecret('DATABASE_URL') || '');
const directUrl = poolerUrl.replace(/-pooler\./, '.');

console.log('Testing pooler URL...');
const pooler = neon(poolerUrl);
const r1 = await pooler.unsafe('SELECT COUNT(*) as cnt FROM "users"');
console.log('Pooler result:', JSON.stringify(r1));

console.log('\nTesting direct URL...');
const direct = neon(directUrl);
const r2 = await direct.unsafe('SELECT COUNT(*) as cnt FROM "users"');
console.log('Direct result:', JSON.stringify(r2));

// Also try template literal on direct
const r3 = await direct`SELECT COUNT(*) as cnt FROM users`;
console.log('Direct template result:', JSON.stringify(r3));
