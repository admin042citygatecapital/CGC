/**
 * websiteStore.ts — Persistent website settings
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeBusinessAddress } from '../../lib/businessLocation.js';
import { privateSubdirectory } from './storagePaths.js';

const STORE_PATH = path.join(privateSubdirectory('cms'), 'website.json');

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readWebsiteSettings(): Record<string, unknown> {
  try {
    ensureDir();
    if (!fs.existsSync(STORE_PATH)) return {};
    const settings = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Record<string, unknown>;
    const address = normalizeBusinessAddress(settings.footerAddress);
    if (settings.footerAddress !== address) {
      settings.footerAddress = address;
      fs.writeFileSync(STORE_PATH, JSON.stringify(settings, null, 2));
    }
    return settings;
  } catch {
    return {};
  }
}

export function writeWebsiteSettings(settings: Record<string, unknown>): void {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(settings, null, 2));
}
