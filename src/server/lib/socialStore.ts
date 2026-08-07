/**
 * socialStore.ts — Persistent social media link configuration
 */
import fs from 'node:fs';
import path from 'node:path';

const STORE_PATH = '/private/cms/social.json';

export interface SocialLink {
  platformId: string;
  url: string;
  enabled: boolean;
  showInFooter: boolean;
  showInContact: boolean;
  showInDashboard: boolean;
}

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readSocialLinks(): SocialLink[] {
  try {
    ensureDir();
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

export function writeSocialLinks(links: SocialLink[]): void {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(links, null, 2));
}
