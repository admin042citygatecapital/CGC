import { spawn } from 'node:child_process';

const env = { ...process.env, NODE_ENV: 'production', PLATFORM_MODE: 'preview' };
for (const key of [
  'APP_URL', 'DATABASE_URL', 'NEON_CONNECTION_STRING', 'SUPABASE_DB_URL',
  'SESSION_SECRET', 'JWT_SECRET', 'CARD_ENCRYPTION_KEY',
  'ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD_HASH_V2',
]) delete env[key];

const child = spawn(process.execPath, ['dist/server.bundle.mjs'], {
  cwd: process.cwd(), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });

const result = await Promise.race([
  new Promise(resolve => child.once('exit', code => resolve({ code }))),
  new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 15_000)),
]);
if ('timeout' in result) {
  child.kill();
  throw new Error('Production guard check timed out; the unsafe server may have started.');
}
if (result.code === 0 || !output.includes('env.validation.fatal')) {
  throw new Error(`Production server did not reject missing critical configuration. Exit: ${result.code}`);
}
console.log(JSON.stringify({ ok: true, rejectedUnsafeProductionStartup: true }));
