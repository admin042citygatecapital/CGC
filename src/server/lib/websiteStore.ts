/**
 * websiteStore.ts — Persistent website settings
 */
import path from 'node:path';
import { normalizeBusinessAddress } from '../../lib/businessLocation.js';
import { privateSubdirectory } from './storagePaths.js';
import { readConfigDocument, writeConfigDocument } from './durableConfigDocument.js';

const STORE_PATH = path.join(privateSubdirectory('cms'), 'website.json');

export async function readWebsiteSettings(): Promise<Record<string, unknown>> {
  const settings = await readConfigDocument<Record<string, unknown>>('website_settings', STORE_PATH, {});
  settings.footerAddress = normalizeBusinessAddress(settings.footerAddress);
  return settings;
}

export async function writeWebsiteSettings(settings: Record<string, unknown>, updatedBy = 'admin'): Promise<void> {
  await writeConfigDocument('website_settings', STORE_PATH, settings, updatedBy);
}
