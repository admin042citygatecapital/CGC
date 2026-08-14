import { privateSubdirectory } from './storagePaths.js';
import { readConfigDocument, writeConfigDocument } from './durableConfigDocument.js';

const KEY = 'admin_cms_settings';
const LEGACY_FILE = privateSubdirectory('admin/cms.json');

export type CmsSettingsDocument = Record<string, string | number | boolean | null> & { updatedAt?: string };

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;

export function validateCmsSettings(value: unknown): CmsSettingsDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length < 1 || entries.length > 100) return null;
  const result: CmsSettingsDocument = {};
  for (const [key, item] of entries) {
    if (key === 'updatedAt' || !KEY_PATTERN.test(key)) return null;
    if (typeof item === 'string') {
      if (item.length > 20_000) return null;
      result[key] = item;
    } else if (typeof item === 'number') {
      if (!Number.isFinite(item)) return null;
      result[key] = item;
    } else if (typeof item === 'boolean' || item === null) {
      result[key] = item;
    } else {
      return null;
    }
  }
  if (JSON.stringify(result).length > 200_000) return null;
  return result;
}

export async function readCmsSettings(): Promise<CmsSettingsDocument | null> {
  return readConfigDocument<CmsSettingsDocument | null>(KEY, LEGACY_FILE, null);
}

export async function writeCmsSettings(document: CmsSettingsDocument, updatedBy: string): Promise<CmsSettingsDocument> {
  const next = { ...document, updatedAt: new Date().toISOString() };
  await writeConfigDocument(KEY, LEGACY_FILE, next, updatedBy);
  return next;
}
