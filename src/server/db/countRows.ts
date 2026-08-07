import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';
const url = String(getSecret('DATABASE_URL') || '');
const sql = neon(url);
const tables = ['users','transactions','cards','wallets','login_events','trading_positions','trading_orders','trading_trades','notifications','canned_responses'];
for (const t of tables) {
  const r = await sql.unsafe(`SELECT COUNT(*) as cnt FROM "${t}"`) as unknown as Array<Record<string, unknown>>;
  console.log(`${t}: ${(r[0] as Record<string,unknown>).cnt}`);
}
