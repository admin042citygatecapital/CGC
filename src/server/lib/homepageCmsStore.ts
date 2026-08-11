import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { home as defaultHomepage } from 'virtual:content';
import { privateSubdirectory } from './storagePaths.js';

export type HomepageContent = typeof defaultHomepage;

export interface HomepageDocument {
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  hash: string;
  content: HomepageContent;
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
  const errors = validateAgainstTemplate(value, defaultHomepage).slice(0, 25);
  return errors.length ? { errors } : { content: value as HomepageContent, errors: [] };
}

export function readHomepageDocument(): HomepageDocument {
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

export function readHomepageHistory(): Array<Omit<HomepageDocument, 'content'> & { reason: string }> {
  try {
    return fs.readFileSync(HISTORY_PATH, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

export function publishHomepageContent(content: HomepageContent, actor: string, reason: string): HomepageDocument {
  fs.mkdirSync(DIRECTORY, { recursive: true });
  const current = readHomepageDocument();
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
