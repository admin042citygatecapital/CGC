/**
 * linksStore.ts — Persistent external links configuration
 */
import { privateSubdirectory } from './storagePaths.js';
import { readConfigDocument, writeConfigDocument } from './durableConfigDocument.js';

const STORE_PATH = privateSubdirectory('cms/links.json');

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

export async function readLinks(): Promise<ExternalLink[]> {
  return readConfigDocument<ExternalLink[]>('external_links', STORE_PATH, []);
}

export async function writeLinks(links: ExternalLink[], updatedBy = 'admin'): Promise<void> {
  await writeConfigDocument('external_links', STORE_PATH, links, updatedBy);
}
