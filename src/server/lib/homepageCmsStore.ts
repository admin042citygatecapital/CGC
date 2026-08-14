import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { home as defaultHomepage } from 'virtual:content';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { privateSubdirectory } from './storagePaths.js';

export interface HomepageRuntimeControls {
  _visibility?: {
    showStats: boolean;
    showTestimonials: boolean;
    showPartners: boolean;
    showNewsSection: boolean;
  };
  _announcement?: {
    enabled: boolean;
    text: string;
    type: 'info' | 'warning' | 'success' | 'maintenance';
  };
}

export type HomepageContent = typeof defaultHomepage & HomepageRuntimeControls;

export interface HomepageAdminView {
  trustBadge: string;
  headline1: string;
  headlineAccent: string;
  headline2: string;
  subheadline: string;
  ctaSecondary: string;
  heroCTAControl: string;
  heroCTAUrgency: string;
  heroCTABenefit: string;
  showStats: boolean;
  showTestimonials: boolean;
  showPartners: boolean;
  showNewsSection: boolean;
  announcementBannerEnabled: boolean;
  announcementBannerText: string;
  announcementBannerType: 'info' | 'warning' | 'success' | 'maintenance';
}

export interface HomepageDocument {
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  hash: string;
  content: HomepageContent;
}

interface HomepageDbRow {
  version: number;
  content: unknown;
  content_hash: string;
  updated_by: string;
  reason: string;
  updated_at: Date | string;
}

const DIRECTORY = privateSubdirectory('cms');
const STORE_PATH = path.join(DIRECTORY, 'homepage.json');
const HISTORY_PATH = path.join(DIRECTORY, 'homepage-history.jsonl');

function cloneDefault(): HomepageContent {
  return JSON.parse(JSON.stringify(defaultHomepage)) as HomepageContent;
}

function digest(content: HomepageContent): string {
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

export function homepageAdminView(content: HomepageContent): HomepageAdminView {
  return {
    trustBadge: content.hero.trustBadge,
    headline1: content.hero.headline1,
    headlineAccent: content.hero.headlineAccent,
    headline2: content.hero.headline2,
    subheadline: content.hero.subheadline,
    ctaSecondary: content.hero.ctaSecondary,
    heroCTAControl: content.hero.heroCTALabels.control,
    heroCTAUrgency: content.hero.heroCTALabels.urgency,
    heroCTABenefit: content.hero.heroCTALabels.benefit,
    showStats: content._visibility?.showStats ?? true,
    showTestimonials: content._visibility?.showTestimonials ?? true,
    showPartners: content._visibility?.showPartners ?? true,
    showNewsSection: content._visibility?.showNewsSection ?? true,
    announcementBannerEnabled: content._announcement?.enabled ?? false,
    announcementBannerText: content._announcement?.text ?? '',
    announcementBannerType: content._announcement?.type ?? 'info',
  };
}

export function mergeHomepageAdminView(
  content: HomepageContent,
  patch: Partial<HomepageAdminView>,
): HomepageContent {
  const next = JSON.parse(JSON.stringify(content)) as HomepageContent;
  const merged = { ...homepageAdminView(next), ...patch };
  next.hero = {
    ...next.hero,
    trustBadge: merged.trustBadge,
    headline1: merged.headline1,
    headlineAccent: merged.headlineAccent,
    headline2: merged.headline2,
    subheadline: merged.subheadline,
    ctaSecondary: merged.ctaSecondary,
    heroCTALabels: {
      control: merged.heroCTAControl,
      urgency: merged.heroCTAUrgency,
      benefit: merged.heroCTABenefit,
    },
  };
  next._visibility = {
    showStats: merged.showStats,
    showTestimonials: merged.showTestimonials,
    showPartners: merged.showPartners,
    showNewsSection: merged.showNewsSection,
  };
  next._announcement = {
    enabled: merged.announcementBannerEnabled,
    text: merged.announcementBannerText,
    type: merged.announcementBannerType,
  };
  return next;
}

export function defaultHomepageAdminView(): HomepageAdminView {
  return homepageAdminView(cloneDefault());
}

function validateAgainstTemplate(value: unknown, template: unknown, pathLabel = 'homepage'): string[] {
  if (typeof template === 'string') {
    if (typeof value !== 'string') return [`${pathLabel} must be text.`];
    if (template.trim().length > 0 && value.trim().length === 0) return [`${pathLabel} cannot be empty.`];
    if (value.length > 2_000) return [`${pathLabel} is too long.`];
    return [];
  }
  if (typeof template === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? [] : [`${pathLabel} must be a finite number.`];
  }
  if (typeof template === 'boolean') return typeof value === 'boolean' ? [] : [`${pathLabel} must be true or false.`];
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return [`${pathLabel} must be a list.`];
    if (value.length > 50) return [`${pathLabel} contains too many items.`];
    const itemTemplate = template[0];
    if (itemTemplate === undefined) return [];
    return value.flatMap((item, index) => validateAgainstTemplate(item, itemTemplate, `${pathLabel}[${index}]`));
  }
  if (template && typeof template === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${pathLabel} must be an object.`];
    const record = value as Record<string, unknown>;
    return Object.entries(template as Record<string, unknown>).flatMap(([key, child]) =>
      validateAgainstTemplate(record[key], child, `${pathLabel}.${key}`),
    );
  }
  return [];
}

export function validateHomepageContent(value: unknown): { content?: HomepageContent; errors: string[] } {
  const errors = validateAgainstTemplate(value, defaultHomepage);
  const controls = value as HomepageRuntimeControls | null;
  if (controls?._visibility) {
    errors.push(...validateAgainstTemplate(controls._visibility, {
      showStats: true,
      showTestimonials: true,
      showPartners: true,
      showNewsSection: true,
    }, 'homepage._visibility'));
  }
  if (controls?._announcement) {
    errors.push(...validateAgainstTemplate(controls._announcement, {
      enabled: false,
      text: '',
      type: 'info',
    }, 'homepage._announcement'));
    if (!['info', 'warning', 'success', 'maintenance'].includes(controls._announcement.type)) {
      errors.push('homepage._announcement.type is invalid.');
    }
  }
  const limitedErrors = errors.slice(0, 25);
  return limitedErrors.length ? { errors: limitedErrors } : { content: value as HomepageContent, errors: [] };
}

function readLocalHomepageDocument(): HomepageDocument {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as HomepageDocument;
    const validated = validateHomepageContent(parsed.content);
    if (!validated.content) throw new Error('Invalid stored homepage document');
    return { ...parsed, hash: digest(validated.content), content: validated.content };
  } catch {
    const content = cloneDefault();
    return { version: 0, updatedAt: null, updatedBy: null, hash: digest(content), content };
  }
}

function readLocalHomepageHistory(): Array<Omit<HomepageDocument, 'content'> & { reason: string }> {
  try {
    return fs.readFileSync(HISTORY_PATH, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function publishLocalHomepageContent(content: HomepageContent, actor: string, reason: string): HomepageDocument {
  fs.mkdirSync(DIRECTORY, { recursive: true });
  const current = readLocalHomepageDocument();
  const next: HomepageDocument = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
    hash: digest(content),
    content,
  };
  const temporary = `${STORE_PATH}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(temporary, STORE_PATH);
  fs.appendFileSync(HISTORY_PATH, `${JSON.stringify({
    version: next.version,
    updatedAt: next.updatedAt,
    updatedBy: next.updatedBy,
    hash: next.hash,
    reason,
  })}\n`, 'utf8');
  return next;
}

function requireDatabaseInProduction(): void {
  if (process.env.NODE_ENV === 'production' && !isDatabaseConfigured()) throw new Error('HOMEPAGE_DATABASE_UNAVAILABLE');
}

function fromDbRow(row: HomepageDbRow): HomepageDocument {
  const validation = validateHomepageContent(row.content);
  if (!validation.content) throw new Error('Stored homepage content is invalid.');
  return {
    version: row.version,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by,
    hash: row.content_hash,
    content: validation.content,
  };
}

let legacyImportChecked = false;
async function importLegacyHomepageOnce(): Promise<void> {
  if (legacyImportChecked || !isDatabaseConfigured()) return;
  const legacy = readLocalHomepageDocument();
  if (legacy.version < 1 || !legacy.updatedAt || !legacy.updatedBy) {
    legacyImportChecked = true;
    return;
  }
  const reason = readLocalHomepageHistory().find(item => item.version === legacy.version)?.reason ?? 'Imported legacy homepage publication';
  const sql = getQueryClient();
  await sql`
    INSERT INTO homepage_content_versions (version,content,content_hash,updated_by,reason,updated_at)
    VALUES (${legacy.version},${sql.json(JSON.parse(JSON.stringify(legacy.content)))},${legacy.hash},${legacy.updatedBy},${reason},${legacy.updatedAt})
    ON CONFLICT (version) DO NOTHING
  `;
  legacyImportChecked = true;
}

export async function readHomepageDocument(): Promise<HomepageDocument> {
  requireDatabaseInProduction();
  if (!isDatabaseConfigured()) return readLocalHomepageDocument();
  await importLegacyHomepageOnce();
  const sql = getQueryClient();
  const rows = await sql<HomepageDbRow[]>`SELECT * FROM homepage_content_versions ORDER BY version DESC LIMIT 1`;
  if (rows[0]) return fromDbRow(rows[0]);
  const content = cloneDefault();
  return { version: 0, updatedAt: null, updatedBy: null, hash: digest(content), content };
}

export async function readHomepageHistory(): Promise<Array<Omit<HomepageDocument, 'content'> & { reason: string }>> {
  requireDatabaseInProduction();
  if (!isDatabaseConfigured()) return readLocalHomepageHistory();
  await importLegacyHomepageOnce();
  const sql = getQueryClient();
  const rows = await sql<HomepageDbRow[]>`SELECT version,content_hash,updated_by,reason,updated_at FROM homepage_content_versions ORDER BY version ASC`;
  return rows.map(row => ({
    version: row.version,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by,
    hash: row.content_hash,
    reason: row.reason,
  }));
}

export async function publishHomepageContent(content: HomepageContent, actor: string, reason: string): Promise<HomepageDocument> {
  requireDatabaseInProduction();
  if (!isDatabaseConfigured()) return publishLocalHomepageContent(content, actor, reason);
  const validation = validateHomepageContent(content);
  if (!validation.content) throw new Error('Homepage content is invalid.');
  const contentHash = digest(validation.content);
  const sql = getQueryClient();
  const rows = await sql.begin(async transaction => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext('homepage_content_versions'))`;
    const current = await transaction<{ version: number }[]>`SELECT COALESCE(MAX(version),0)::int AS version FROM homepage_content_versions`;
    return transaction<HomepageDbRow[]>`
      INSERT INTO homepage_content_versions (version,content,content_hash,updated_by,reason)
      VALUES (${current[0].version + 1},${transaction.json(JSON.parse(JSON.stringify(validation.content)))},${contentHash},${actor},${reason})
      RETURNING *
    `;
  });
  return fromDbRow(rows[0]);
}
