/**
 * linksStore.ts — Persistent external links configuration
 */
import fs from 'node:fs';
import path from 'node:path';

const STORE_PATH = '/private/cms/links.json';

export interface ExternalLink {
  id: string;
  title: string;
  url: string;
  description: string;
  category: string;
  enabled: boolean;
  showInDashboard: boolean;
  showInFooter: boolean;
  icon: string;
  badge: string;
}

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readLinks(): ExternalLink[] {
  try {
    ensureDir();
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

export function writeLinks(links: ExternalLink[]): void {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(links, null, 2));
}
