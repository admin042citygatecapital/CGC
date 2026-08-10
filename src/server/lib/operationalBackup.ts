import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { desc } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { operationsItems } from '../db/schema.js';
import { privateDataRoot, privateSubdirectory } from './storagePaths.js';

const FILE_PATTERN = /^operations-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json\.gz$/;
let workerStarted = false;

function backupsEnabled(): boolean {
  if (process.env.ENABLE_LOCAL_OPERATIONAL_BACKUPS === '0') return false;
  if (process.env.ENABLE_LOCAL_OPERATIONAL_BACKUPS === '1') return true;
  return process.env.NODE_ENV === 'production' && isDatabaseConfigured();
}

function backupDirectory(): string {
  return process.env.BACKUP_DIRECTORY?.trim() || privateSubdirectory('backups');
}

function retentionDays(): number {
  const value = Number.parseInt(process.env.BACKUP_RETENTION_DAYS ?? '14', 10);
  return Number.isInteger(value) && value >= 1 && value <= 365 ? value : 14;
}

function intervalHours(): number {
  const value = Number.parseInt(process.env.BACKUP_INTERVAL_HOURS ?? '24', 10);
  return Number.isInteger(value) && value >= 1 && value <= 168 ? value : 24;
}

function ensureSafeDirectory(directory: string): string {
  const resolved = path.resolve(directory);
  const privateRoot = path.resolve(privateDataRoot);
  if (resolved !== privateRoot && !resolved.startsWith(`${privateRoot}${path.sep}`)) {
    throw new Error('BACKUP_DIRECTORY must be inside PRIVATE_DATA_ROOT');
  }
  return resolved;
}

export async function createOperationalBackup(): Promise<{ file: string; checksum: string; count: number; bytes: number }> {
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is required for an operational backup');
  const directory = ensureSafeDirectory(backupDirectory());
  fs.mkdirSync(directory, { recursive: true });
  const rows = await getDb().select().from(operationsItems).orderBy(desc(operationsItems.updatedAt));
  const createdAt = new Date().toISOString();
  const payload = Buffer.from(JSON.stringify({
    format: 'cgc-operations-backup', version: 1, createdAt,
    source: 'postgresql', table: 'operations_items', count: rows.length, items: rows,
  }), 'utf8');
  const compressed = zlib.gzipSync(payload, { level: 9 });
  const checksum = crypto.createHash('sha256').update(compressed).digest('hex');
  const filename = `operations-${createdAt.replace(/[:.]/g, '-')}.json.gz`;
  const finalPath = path.join(directory, filename);
  const tempPath = `${finalPath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tempPath, compressed, { flag: 'wx', mode: 0o600 });
  fs.renameSync(tempPath, finalPath);
  fs.writeFileSync(`${finalPath}.sha256`, `${checksum}  ${filename}\n`, { mode: 0o600 });
  pruneOperationalBackups(directory);
  return { file: finalPath, checksum, count: rows.length, bytes: compressed.byteLength };
}

function pruneOperationalBackups(directory: string): void {
  const cutoff = Date.now() - retentionDays() * 86_400_000;
  for (const name of fs.readdirSync(directory)) {
    if (!FILE_PATTERN.test(name)) continue;
    const target = path.resolve(directory, name);
    if (!target.startsWith(`${path.resolve(directory)}${path.sep}`)) continue;
    if (fs.statSync(target).mtimeMs >= cutoff) continue;
    fs.rmSync(target, { force: true });
    fs.rmSync(`${target}.sha256`, { force: true });
  }
}

export function getOperationalBackupStatus(): {
  enabled: boolean; directory: string; latestAt?: string; ageHours?: number;
  checksumValid?: boolean; error?: string;
} {
  const enabled = backupsEnabled();
  try {
    const directory = ensureSafeDirectory(backupDirectory());
    if (!fs.existsSync(directory)) return { enabled, directory };
    const latest = fs.readdirSync(directory).filter(name => FILE_PATTERN.test(name))
      .map(name => ({ name, mtime: fs.statSync(path.join(directory, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0];
    if (!latest) return { enabled, directory };
    const fullPath = path.join(directory, latest.name);
    const checksumFile = `${fullPath}.sha256`;
    const expected = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0] : '';
    const actual = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
    return {
      enabled, directory, latestAt: new Date(latest.mtime).toISOString(),
      ageHours: Math.round(((Date.now() - latest.mtime) / 3_600_000) * 10) / 10,
      checksumValid: Boolean(expected) && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual)),
    };
  } catch (error) {
    return { enabled, directory: backupDirectory(), error: error instanceof Error ? error.message : String(error) };
  }
}

export function startOperationalBackupWorker(): void {
  if (workerStarted || !backupsEnabled()) return;
  workerStarted = true;
  const run = () => createOperationalBackup()
    .then(result => console.log(JSON.stringify({ event: 'operations.backup.completed', count: result.count, bytes: result.bytes })))
    .catch(error => console.error(JSON.stringify({ event: 'operations.backup.failed', error: String(error) })));
  void run();
  const timer = setInterval(run, intervalHours() * 3_600_000);
  timer.unref();
}
