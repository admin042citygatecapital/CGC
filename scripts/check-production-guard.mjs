import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const env = { ...process.env, NODE_ENV: 'production', PLATFORM_MODE: 'preview' };
for (const key of [
  'APP_URL', 'DATABASE_URL',
  'SESSION_SECRET', 'JWT_SECRET', 'CARD_ENCRYPTION_KEY',
  'ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD_HASH_V2',
]) delete env[key];

// Startup modules may initialize private stores before environment validation.
// Give the rejected-startup probe writable, disposable storage so a read-only
// host filesystem cannot mask the expected env.validation.fatal event.
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'cgc-production-guard-'));
env.PRIVATE_DATA_ROOT = temporaryRoot;
env.MEDIA_ASSET_ROOT = path.join(temporaryRoot, 'media');
env.BACKUP_DIRECTORY = path.join(temporaryRoot, 'backups');

const child = spawn(process.execPath, ['dist/server.bundle.mjs'], {
  cwd: process.cwd(), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });

try {
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
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
