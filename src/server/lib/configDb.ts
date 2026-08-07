/**
 * configDb.ts — PostgreSQL-backed key/value config store.
 *
 * Used by configuration stores (smtpConfig, rates, integrations, etc.)
 * that previously stored JSON blobs in flat files.
 *
 * Falls back to flat-file when DATABASE_URL is not configured.
 */

import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { config } from '../db/schema.js';

/**
 * Read a config value by key.
 * Returns null if not found.
 */
export async function getConfig<T = unknown>(key: string): Promise<T | null> {
  if (!isDatabaseConfigured()) return null;
  const db   = getDb();
  const rows = await db.select().from(config).where(eq(config.key, key)).limit(1);
  if (rows.length === 0) return null;
  return rows[0].value as T;
}

/**
 * Write a config value by key.
 * Creates or updates the record.
 */
export async function setConfig<T = unknown>(key: string, value: T, updatedBy?: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db.insert(config).values({
    key,
    value:     value as Record<string, unknown>,
    updatedAt: new Date(),
    updatedBy: updatedBy ?? null,
  }).onConflictDoUpdate({
    target: config.key,
    set: {
      value:     value as Record<string, unknown>,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    },
  });
}

/**
 * Delete a config key.
 */
export async function deleteConfig(key: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db.delete(config).where(eq(config.key, key));
}

/**
 * List all config keys.
 */
export async function listConfigKeys(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const db   = getDb();
  const rows = await db.select({ key: config.key }).from(config);
  return rows.map(r => r.key);
}
