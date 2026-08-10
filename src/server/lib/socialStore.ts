/** PostgreSQL-backed social profile links and manual share-intent history. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { desc, sql } from 'drizzle-orm';
import { getDb, getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { socialProfiles, socialShareEvents } from '../db/schema.js';
import type { SocialProfileRow, SocialShareEventRow } from '../db/schema.js';
import { privateSubdirectory } from './storagePaths.js';

export const SOCIAL_PLATFORM_IDS = [
  'twitter', 'linkedin', 'instagram', 'facebook', 'telegram',
  'whatsapp', 'tiktok', 'youtube', 'discord',
] as const;
export type SocialPlatformId = typeof SOCIAL_PLATFORM_IDS[number];

export interface SocialLink {
  platformId: SocialPlatformId;
  url: string;
  enabled: boolean;
  showInFooter: boolean;
  showInContact: boolean;
  showInDashboard: boolean;
}

export interface SocialShareTarget {
  platformId: SocialPlatformId;
  mode: 'intent' | 'copy';
  url?: string;
  note?: string;
}

export interface SocialShareEvent {
  id: string;
  message: string;
  targetUrl: string;
  platforms: SocialPlatformId[];
  openedPlatforms: SocialPlatformId[];
  status: 'ready' | 'opened';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  targets: SocialShareTarget[];
}

const ALLOWED_HOSTS: Record<SocialPlatformId, readonly string[]> = {
  twitter: ['x.com', 'twitter.com'],
  linkedin: ['linkedin.com'],
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  telegram: ['t.me', 'telegram.me'],
  whatsapp: ['wa.me', 'whatsapp.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  discord: ['discord.com', 'discord.gg'],
};

const legacyFile = path.join(privateSubdirectory('cms'), 'social.json');
let legacySyncComplete = false;

function isPlatformId(value: unknown): value is SocialPlatformId {
  return typeof value === 'string' && (SOCIAL_PLATFORM_IDS as readonly string[]).includes(value);
}

function parseHttpUrl(value: string): URL {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('URL must use http or https');
  url.username = '';
  url.password = '';
  url.hash = '';
  return url;
}

export function validateProfileUrl(platformId: SocialPlatformId, value: string): string {
  if (!value.trim()) return '';
  const url = parseHttpUrl(value);
  const hostname = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS[platformId].some(host => hostname === host || hostname.endsWith(`.${host}`))) {
    throw new Error(`URL does not match ${platformId}`);
  }
  return url.toString();
}

export function validateTargetUrl(value: string): string {
  return parseHttpUrl(value).toString();
}

export function normalizeSocialLinks(input: unknown): SocialLink[] {
  if (!Array.isArray(input)) throw new Error('links must be an array');
  const byPlatform = new Map<SocialPlatformId, SocialLink>();
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    if (!isPlatformId(raw.platformId)) continue;
    byPlatform.set(raw.platformId, {
      platformId: raw.platformId,
      url: validateProfileUrl(raw.platformId, typeof raw.url === 'string' ? raw.url : ''),
      enabled: raw.enabled === true,
      showInFooter: raw.showInFooter !== false,
      showInContact: raw.showInContact !== false,
      showInDashboard: raw.showInDashboard === true,
    });
  }
  return [...byPlatform.values()];
}

function rowToLink(row: SocialProfileRow): SocialLink {
  return {
    platformId: row.platformId as SocialPlatformId,
    url: row.url,
    enabled: row.enabled,
    showInFooter: row.showInFooter,
    showInContact: row.showInContact,
    showInDashboard: row.showInDashboard,
  };
}

export function buildShareTargets(
  message: string,
  targetUrl: string,
  platforms: SocialPlatformId[],
): SocialShareTarget[] {
  const cleanUrl = validateTargetUrl(targetUrl);
  const text = message.trim().slice(0, 1000);
  if (!text) throw new Error('Message is required');
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(cleanUrl);
  const builders: Partial<Record<SocialPlatformId, () => string>> = {
    twitter: () => `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    linkedin: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    facebook: () => `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    telegram: () => `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    whatsapp: () => `https://wa.me/?text=${encodeURIComponent(`${text} ${cleanUrl}`)}`,
  };
  return [...new Set(platforms)].map(platformId => {
    const builder = builders[platformId];
    return builder
      ? { platformId, mode: 'intent' as const, url: builder() }
      : { platformId, mode: 'copy' as const, note: 'Copy the prepared content into this platform.' };
  });
}

function rowToShare(row: SocialShareEventRow): SocialShareEvent {
  const platforms = (row.platforms ?? []).filter(isPlatformId);
  return {
    id: row.id,
    message: row.message,
    targetUrl: row.targetUrl,
    platforms,
    openedPlatforms: (row.openedPlatforms ?? []).filter(isPlatformId),
    status: row.status as 'ready' | 'opened',
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    targets: buildShareTargets(row.message, row.targetUrl, platforms),
  };
}

function readLegacyLinks(): SocialLink[] {
  try {
    if (!fs.existsSync(legacyFile)) return [];
    return normalizeSocialLinks(JSON.parse(fs.readFileSync(legacyFile, 'utf8')));
  } catch {
    return [];
  }
}

function writeLegacyLinks(links: SocialLink[]): void {
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
  fs.writeFileSync(legacyFile, JSON.stringify(links, null, 2));
}

export async function syncLegacySocialLinks(): Promise<void> {
  if (legacySyncComplete || !isDatabaseConfigured()) return;
  const existing = await getDb().select({ platformId: socialProfiles.platformId }).from(socialProfiles).limit(1);
  if (existing.length === 0) {
    const links = readLegacyLinks();
    if (links.length) await writeSocialLinks(links, 'legacy-import');
  }
  legacySyncComplete = true;
}

export async function readSocialLinks(): Promise<SocialLink[]> {
  if (!isDatabaseConfigured()) return readLegacyLinks();
  await syncLegacySocialLinks();
  const rows = await getDb().select().from(socialProfiles);
  return rows.filter(row => isPlatformId(row.platformId)).map(rowToLink);
}

export async function writeSocialLinks(input: unknown, actor = 'system'): Promise<SocialLink[]> {
  const links = normalizeSocialLinks(input);
  if (!isDatabaseConfigured()) {
    writeLegacyLinks(links);
    return links;
  }
  if (!links.length) return [];
  const now = new Date();
  await getDb().insert(socialProfiles).values(links.map(link => ({ ...link, updatedBy: actor, updatedAt: now })))
    .onConflictDoUpdate({
      target: socialProfiles.platformId,
      set: {
        url: sql`excluded.url`, enabled: sql`excluded.enabled`,
        showInFooter: sql`excluded.show_in_footer`, showInContact: sql`excluded.show_in_contact`,
        showInDashboard: sql`excluded.show_in_dashboard`, updatedBy: actor, updatedAt: now,
      },
    });
  return links;
}

export async function createSocialShare(input: {
  message: string; targetUrl: string; platforms: unknown; createdBy: string;
}): Promise<SocialShareEvent> {
  const message = input.message.trim().slice(0, 1000);
  if (!message) throw new Error('Message is required');
  const targetUrl = validateTargetUrl(input.targetUrl);
  if (!Array.isArray(input.platforms)) throw new Error('Select at least one platform');
  const platforms = [...new Set(input.platforms.filter(isPlatformId))];
  if (!platforms.length) throw new Error('Select at least one platform');
  const now = new Date();
  const row: SocialShareEventRow = {
    id: `share_${crypto.randomBytes(8).toString('hex')}`,
    message, targetUrl, platforms, openedPlatforms: [], status: 'ready',
    createdBy: input.createdBy.slice(0, 254), createdAt: now, updatedAt: now,
  };
  if (isDatabaseConfigured()) await getDb().insert(socialShareEvents).values(row);
  return rowToShare(row);
}

export async function listSocialShares(limit = 30): Promise<SocialShareEvent[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await getDb().select().from(socialShareEvents)
    .orderBy(desc(socialShareEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
  return rows.map(rowToShare);
}

export async function markSocialShareOpened(id: string, platformId: unknown): Promise<SocialShareEvent | null> {
  if (!isPlatformId(platformId)) throw new Error('Invalid platform');
  if (!isDatabaseConfigured()) return null;
  const client = getQueryClient();
  const opened = JSON.stringify([platformId]);
  const rows = await client<SocialShareEventRow[]>`
    UPDATE social_share_events SET
      opened_platforms = CASE WHEN opened_platforms @> ${opened}::jsonb
        THEN opened_platforms ELSE opened_platforms || ${opened}::jsonb END,
      status = 'opened', updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, message, target_url AS "targetUrl", platforms,
      opened_platforms AS "openedPlatforms", status, created_by AS "createdBy",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return rows[0] ? rowToShare(rows[0]) : null;
}
