/** Durable JSON configuration documents backed by the existing PostgreSQL config table. */
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { config as configTable } from '../db/schema.js';

function readLegacy<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function requireDatabaseInProduction(): void {
  if (process.env.NODE_ENV === 'production' && !isDatabaseConfigured()) throw new Error('CONFIG_DATABASE_UNAVAILABLE');
}

export async function readConfigDocument<T>(key: string, legacyFile: string, fallback: T): Promise<T> {
  requireDatabaseInProduction();
  if (!isDatabaseConfigured()) return readLegacy(legacyFile, fallback);
  const db = getDb();
  const rows = await db.select({ value: configTable.value }).from(configTable).where(eq(configTable.key, key)).limit(1);
  if (rows[0]) {
    if (rows[0].value && Object.prototype.hasOwnProperty.call(rows[0].value, 'data')) {
      return (rows[0].value as { data: T }).data;
    }
    throw new Error(`CONFIG_DOCUMENT_INVALID:${key}`);
  }
  const legacy = readLegacy(legacyFile, fallback);
  await db.insert(configTable).values({ key, value: { data: legacy } as unknown as Record<string, unknown>, updatedBy: 'migration' })
    .onConflictDoNothing({ target: configTable.key });
  return legacy;
}

export async function writeConfigDocument<T>(key: string, legacyFile: string, value: T, updatedBy = 'admin'): Promise<void> {
  requireDatabaseInProduction();
  if (isDatabaseConfigured()) {
    const db = getDb();
    await db.insert(configTable).values({ key, value: { data: value } as unknown as Record<string, unknown>, updatedBy })
      .onConflictDoUpdate({
        target: configTable.key,
        set: { value: { data: value } as unknown as Record<string, unknown>, updatedBy, updatedAt: new Date() },
      });
    return;
  }
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
  fs.writeFileSync(legacyFile, JSON.stringify(value, null, 2), 'utf8');
}
