/**
 * websiteStore.ts — Persistent website settings
 */
import fs from 'node:fs';
import path from 'node:path';

const STORE_PATH = '/private/cms/website.json';

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readWebsiteSettings(): Record<string, unknown> {
  try {
    ensureDir();
    if (!fs.existsSync(STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function writeWebsiteSettings(settings: Record<string, unknown>): void {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(settings, null, 2));
}
