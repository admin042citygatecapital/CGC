/**
 * mediaStore.ts
 * Persistent flat-file store for the Admin Media Library.
 * Files are stored in /shared-storage/public/assets/media/
 * Metadata records live in /private/media/index.jsonl
 */
import fs   from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mediaDirectory } from './storagePaths.js';

const META_DIR  = '/private/media';
const META_FILE = path.join(META_DIR, 'index.jsonl');
const ASSET_DIR = mediaDirectory;

function ensureDirs() {
  if (!fs.existsSync(META_DIR))  fs.mkdirSync(META_DIR,  { recursive: true });
  if (!fs.existsSync(ASSET_DIR)) fs.mkdirSync(ASSET_DIR, { recursive: true });
}

function readAll(): MediaRecord[] {
  try {
    ensureDirs();
    if (!fs.existsSync(META_FILE)) return [];
    return fs.readFileSync(META_FILE, 'utf8')
      .split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch { return []; }
}

function writeAll(records: MediaRecord[]): void {
  ensureDirs();
  fs.writeFileSync(META_FILE, records.map(r => JSON.stringify(r)).join('\n') + '\n');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaType = 'image' | 'video' | 'pdf' | 'document';

export interface MediaRecord {
  id:           string;
  filename:     string;          // stored filename on disk / storage key stem
  originalName: string;          // original upload name
  mimeType:     string;
  type:         MediaType;
  size:         number;          // bytes
  url:          string;          // public URL (Supabase CDN or local path)
  storageKey?:  string;          // Supabase Storage object key (e.g. "media/filename.jpg")
  alt:          string;
  tags:         string[];
  folder:       string;
  width?:       number;
  height?:      number;
  duration?:    number;          // seconds (video)
  optimized:    boolean;
  optimizedSize?: number;
  replacedById?: string;
  uploadedBy:   string;
  createdAt:    string;
  updatedAt:    string;
}

export interface MediaListOptions {
  type?:    MediaType | '';
  folder?:  string;
  tag?:     string;
  search?:  string;
  page?:    number;
  limit?:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mimeToType(mime: string): MediaType {
  if (mime.startsWith('image/'))       return 'image';
  if (mime.startsWith('video/'))       return 'video';
  if (mime === 'application/pdf')      return 'pdf';
  return 'document';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function listMedia(opts: MediaListOptions = {}): { data: MediaRecord[]; total: number } {
  let records = readAll();

  if (opts.type)   records = records.filter(r => r.type   === opts.type);
  if (opts.folder) records = records.filter(r => r.folder === opts.folder);
  if (opts.tag)    records = records.filter(r => r.tags.includes(opts.tag!));
  if (opts.search) {
    const q = opts.search.toLowerCase();
    records = records.filter(r =>
      r.originalName.toLowerCase().includes(q) ||
      r.alt.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = records.length;
  const page  = opts.page  ?? 1;
  const limit = opts.limit ?? 50;
  return { data: records.slice((page - 1) * limit, page * limit), total };
}

export function getMedia(id: string): MediaRecord | null {
  return readAll().find(r => r.id === id) ?? null;
}

export function createMediaRecord(params: {
  originalName: string;
  mimeType:     string;
  size:         number;
  buffer:       Buffer;
  url?:         string;         // override URL (e.g. Supabase CDN URL)
  storageKey?:  string;         // Supabase Storage key
  alt?:         string;
  tags?:        string[];
  folder?:      string;
  width?:       number;
  height?:      number;
  duration?:    number;
  uploadedBy?:  string;
}): MediaRecord {
  ensureDirs();
  const id       = randomUUID();
  const ext      = path.extname(params.originalName) || '';
  const stem     = sanitizeFilename(path.basename(params.originalName, ext));
  const filename = `${stem}-${id.slice(0, 8)}${ext}`;

  // Only write to local disk if no external URL was provided
  if (!params.url) {
    const filePath = path.join(ASSET_DIR, filename);
    fs.writeFileSync(filePath, params.buffer);
  }

  const record: MediaRecord = {
    id,
    filename,
    originalName: params.originalName,
    mimeType:     params.mimeType,
    type:         mimeToType(params.mimeType),
    size:         params.size,
    url:          params.url ?? `/airo-assets/uploads/media/${filename}`,
    storageKey:   params.storageKey,
    alt:          params.alt    ?? '',
    tags:         params.tags   ?? [],
    folder:       params.folder ?? 'uncategorized',
    width:        params.width,
    height:       params.height,
    duration:     params.duration,
    optimized:    false,
    uploadedBy:   params.uploadedBy ?? 'admin',
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString(),
  };

  const all = readAll();
  all.push(record);
  writeAll(all);
  return record;
}

export function updateMediaRecord(id: string, patch: Partial<Pick<MediaRecord, 'alt' | 'tags' | 'folder'>>): MediaRecord | null {
  const all = readAll();
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

export function deleteMediaRecord(id: string): boolean {
  const all = readAll();
  const rec = all.find(r => r.id === id);
  if (!rec) return false;

  // Remove file from disk (best-effort)
  try {
    const filePath = path.join(ASSET_DIR, rec.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }

  writeAll(all.filter(r => r.id !== id));
  return true;
}

export function replaceMediaRecord(id: string, params: {
  originalName: string;
  mimeType:     string;
  size:         number;
  buffer:       Buffer;
  url?:         string;         // override URL (e.g. Supabase CDN URL)
  storageKey?:  string;         // Supabase Storage key
}): MediaRecord | null {
  const all = readAll();
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return null;

  const old = all[idx];

  // Remove old local file only if it was stored locally (no storageKey)
  if (!old.storageKey) {
    try {
      const oldPath = path.join(ASSET_DIR, old.filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch { /* ignore */ }
  }

  // Write new file to local disk only if no external URL provided
  ensureDirs();
  const ext      = path.extname(params.originalName) || '';
  const stem     = sanitizeFilename(path.basename(params.originalName, ext));
  const filename = `${stem}-${id.slice(0, 8)}${ext}`;

  if (!params.url) {
    const filePath = path.join(ASSET_DIR, filename);
    fs.writeFileSync(filePath, params.buffer);
  }

  all[idx] = {
    ...old,
    filename,
    originalName: params.originalName,
    mimeType:     params.mimeType,
    type:         mimeToType(params.mimeType),
    size:         params.size,
    url:          params.url ?? `/airo-assets/uploads/media/${filename}`,
    storageKey:   params.storageKey,
    optimized:    false,
    updatedAt:    new Date().toISOString(),
  };
  writeAll(all);
  return all[idx];
}

export function markOptimized(id: string, optimizedSize: number): MediaRecord | null {
  const all = readAll();
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], optimized: true, optimizedSize, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

export function getMediaStats(): {
  total: number; images: number; videos: number; pdfs: number; documents: number;
  totalSize: number; optimizedCount: number;
} {
  const all = readAll();
  return {
    total:          all.length,
    images:         all.filter(r => r.type === 'image').length,
    videos:         all.filter(r => r.type === 'video').length,
    pdfs:           all.filter(r => r.type === 'pdf').length,
    documents:      all.filter(r => r.type === 'document').length,
    totalSize:      all.reduce((s, r) => s + r.size, 0),
    optimizedCount: all.filter(r => r.optimized).length,
  };
}

export function getFolders(): string[] {
  const all = readAll();
  return [...new Set(all.map(r => r.folder))].sort();
}

export function getAllTags(): string[] {
  const all = readAll();
  return [...new Set(all.flatMap(r => r.tags))].sort();
}
