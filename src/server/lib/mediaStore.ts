/** Durable media metadata backed by PostgreSQL with a development-only file fallback. */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { mediaDirectory, privateSubdirectory } from './storagePaths.js';

const META_DIR = privateSubdirectory('media');
const META_FILE = path.join(META_DIR, 'index.jsonl');
const ASSET_DIR = mediaDirectory;

export type MediaType = 'image' | 'video' | 'pdf' | 'document';
export interface MediaRecord {
  id: string; filename: string; originalName: string; mimeType: string; type: MediaType;
  size: number; url: string; storageKey?: string; alt: string; tags: string[]; folder: string;
  width?: number; height?: number; duration?: number; optimized: boolean; optimizedSize?: number;
  replacedById?: string; uploadedBy: string; createdAt: string; updatedAt: string;
}
export interface MediaListOptions { type?: MediaType | ''; folder?: string; tag?: string; search?: string; page?: number; limit?: number; }
interface MediaDbRow {
  id: string; filename: string; original_name: string; mime_type: string; media_type: MediaType;
  size_bytes: string | number; public_url: string; storage_key: string | null; alt_text: string;
  tags: unknown; folder: string; width: number | null; height: number | null; duration_seconds: number | null;
  optimized: boolean; optimized_size_bytes: string | number | null; replaced_by_id: string | null;
  uploaded_by: string; created_at: Date | string; updated_at: Date | string;
}

function ensureDirs(): void {
  fs.mkdirSync(META_DIR, { recursive: true });
  fs.mkdirSync(ASSET_DIR, { recursive: true });
}
function readLocal(): MediaRecord[] {
  try {
    ensureDirs();
    if (!fs.existsSync(META_FILE)) return [];
    return fs.readFileSync(META_FILE, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as MediaRecord);
  } catch { return []; }
}
function writeLocal(records: MediaRecord[]): void {
  ensureDirs();
  fs.writeFileSync(META_FILE, `${records.map(record => JSON.stringify(record)).join('\n')}\n`);
}
function requireDurableProductionStore(): void {
  if (process.env.NODE_ENV === 'production' && !isDatabaseConfigured()) throw new Error('MEDIA_DATABASE_UNAVAILABLE');
}
function mimeToType(mime: string): MediaType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'document';
}
function sanitizeFilename(name: string): string { return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase(); }
function asIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
function tagsFrom(value: unknown): string[] { return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : []; }
function fromRow(row: MediaDbRow): MediaRecord {
  return {
    id: row.id, filename: row.filename, originalName: row.original_name, mimeType: row.mime_type,
    type: row.media_type, size: Number(row.size_bytes), url: row.public_url,
    storageKey: row.storage_key ?? undefined, alt: row.alt_text, tags: tagsFrom(row.tags), folder: row.folder,
    width: row.width ?? undefined, height: row.height ?? undefined, duration: row.duration_seconds ?? undefined,
    optimized: row.optimized, optimizedSize: row.optimized_size_bytes == null ? undefined : Number(row.optimized_size_bytes),
    replacedById: row.replaced_by_id ?? undefined, uploadedBy: row.uploaded_by,
    createdAt: asIso(row.created_at), updatedAt: asIso(row.updated_at),
  };
}
async function insertDatabase(record: MediaRecord): Promise<void> {
  const sql = getQueryClient();
  await sql`
    INSERT INTO media_assets (id,filename,original_name,mime_type,media_type,size_bytes,public_url,storage_key,alt_text,tags,folder,width,height,duration_seconds,optimized,optimized_size_bytes,replaced_by_id,uploaded_by,created_at,updated_at)
    VALUES (${record.id},${record.filename},${record.originalName},${record.mimeType},${record.type},${record.size},${record.url},${record.storageKey ?? null},${record.alt},${sql.json(record.tags)},${record.folder},${record.width ?? null},${record.height ?? null},${record.duration ?? null},${record.optimized},${record.optimizedSize ?? null},${record.replacedById ?? null},${record.uploadedBy},${record.createdAt},${record.updatedAt})
    ON CONFLICT (id) DO NOTHING
  `;
}
let importedLocalMetadata = false;
async function importLocalMetadataOnce(): Promise<void> {
  if (importedLocalMetadata || !isDatabaseConfigured()) return;
  importedLocalMetadata = true;
  for (const record of readLocal()) await insertDatabase(record);
}
async function readAll(): Promise<MediaRecord[]> {
  requireDurableProductionStore();
  if (!isDatabaseConfigured()) return readLocal();
  await importLocalMetadataOnce();
  const sql = getQueryClient();
  const rows = await sql<MediaDbRow[]>`SELECT * FROM media_assets ORDER BY created_at DESC`;
  return rows.map(fromRow);
}

export async function listMedia(opts: MediaListOptions = {}): Promise<{ data: MediaRecord[]; total: number }> {
  let records = await readAll();
  if (opts.type) records = records.filter(record => record.type === opts.type);
  if (opts.folder) records = records.filter(record => record.folder === opts.folder);
  if (opts.tag) records = records.filter(record => record.tags.includes(opts.tag!));
  if (opts.search) {
    const query = opts.search.toLowerCase();
    records = records.filter(record => record.originalName.toLowerCase().includes(query) || record.alt.toLowerCase().includes(query) || record.tags.some(tag => tag.toLowerCase().includes(query)));
  }
  const total = records.length;
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  return { data: records.slice((page - 1) * limit, page * limit), total };
}

export async function getMedia(id: string): Promise<MediaRecord | null> {
  requireDurableProductionStore();
  if (!isDatabaseConfigured()) return readLocal().find(record => record.id === id) ?? null;
  await importLocalMetadataOnce();
  const sql = getQueryClient();
  const rows = await sql<MediaDbRow[]>`SELECT * FROM media_assets WHERE id=${id} LIMIT 1`;
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createMediaRecord(params: {
  originalName: string; mimeType: string; size: number; buffer: Buffer; url?: string; storageKey?: string;
  alt?: string; tags?: string[]; folder?: string; width?: number; height?: number; duration?: number; uploadedBy?: string;
}): Promise<MediaRecord> {
  requireDurableProductionStore();
  const id = randomUUID();
  const ext = path.extname(params.originalName) || '';
  const stem = sanitizeFilename(path.basename(params.originalName, ext));
  const filename = `${stem}-${id.slice(0, 8)}${ext}`;
  if (!params.url) { ensureDirs(); fs.writeFileSync(path.join(ASSET_DIR, filename), params.buffer); }
  const now = new Date().toISOString();
  const record: MediaRecord = {
    id, filename, originalName: params.originalName, mimeType: params.mimeType, type: mimeToType(params.mimeType),
    size: params.size, url: params.url ?? `/airo-assets/uploads/media/${filename}`, storageKey: params.storageKey,
    alt: params.alt?.trim().slice(0, 300) ?? '', tags: (params.tags ?? []).filter(tag => typeof tag === 'string').map(tag => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 20),
    folder: params.folder?.trim().slice(0, 80) || 'uncategorized', width: params.width, height: params.height,
    duration: params.duration, optimized: false, uploadedBy: params.uploadedBy ?? 'admin', createdAt: now, updatedAt: now,
  };
  if (isDatabaseConfigured()) await insertDatabase(record);
  else { const all = readLocal(); all.push(record); writeLocal(all); }
  return record;
}

export async function updateMediaRecord(id: string, patch: Partial<Pick<MediaRecord, 'alt' | 'tags' | 'folder'>>): Promise<MediaRecord | null> {
  const existing = await getMedia(id);
  if (!existing) return null;
  const next = {
    alt: patch.alt?.trim().slice(0, 300) ?? existing.alt,
    tags: patch.tags ? patch.tags.map(tag => String(tag).trim().slice(0, 40)).filter(Boolean).slice(0, 20) : existing.tags,
    folder: patch.folder?.trim().slice(0, 80) || existing.folder,
  };
  if (isDatabaseConfigured()) {
    const sql = getQueryClient();
    const rows = await sql<MediaDbRow[]>`UPDATE media_assets SET alt_text=${next.alt},tags=${sql.json(next.tags)},folder=${next.folder},updated_at=NOW() WHERE id=${id} RETURNING *`;
    return rows[0] ? fromRow(rows[0]) : null;
  }
  const all = readLocal(); const index = all.findIndex(record => record.id === id);
  all[index] = { ...all[index], ...next, updatedAt: new Date().toISOString() }; writeLocal(all); return all[index];
}

export async function deleteMediaRecord(id: string): Promise<boolean> {
  const existing = await getMedia(id);
  if (!existing) return false;
  if (isDatabaseConfigured()) { const sql = getQueryClient(); await sql`DELETE FROM media_assets WHERE id=${id}`; }
  else { writeLocal(readLocal().filter(record => record.id !== id)); }
  if (!existing.storageKey) { try { fs.unlinkSync(path.join(ASSET_DIR, existing.filename)); } catch { /* absent */ } }
  return true;
}

export async function replaceMediaRecord(id: string, params: { originalName: string; mimeType: string; size: number; buffer: Buffer; url?: string; storageKey?: string }): Promise<MediaRecord | null> {
  const existing = await getMedia(id);
  if (!existing) return null;
  const ext = path.extname(params.originalName) || '';
  const filename = `${sanitizeFilename(path.basename(params.originalName, ext))}-${id.slice(0, 8)}${ext}`;
  if (!params.url) { ensureDirs(); fs.writeFileSync(path.join(ASSET_DIR, filename), params.buffer); }
  const next = { ...existing, filename, originalName: params.originalName, mimeType: params.mimeType, type: mimeToType(params.mimeType), size: params.size, url: params.url ?? `/airo-assets/uploads/media/${filename}`, storageKey: params.storageKey, optimized: false, optimizedSize: undefined, updatedAt: new Date().toISOString() };
  if (isDatabaseConfigured()) {
    const sql = getQueryClient();
    const rows = await sql<MediaDbRow[]>`UPDATE media_assets SET filename=${next.filename},original_name=${next.originalName},mime_type=${next.mimeType},media_type=${next.type},size_bytes=${next.size},public_url=${next.url},storage_key=${next.storageKey ?? null},optimized=FALSE,optimized_size_bytes=NULL,updated_at=NOW() WHERE id=${id} RETURNING *`;
    return rows[0] ? fromRow(rows[0]) : null;
  }
  const all = readLocal(); const index = all.findIndex(record => record.id === id); all[index] = next; writeLocal(all); return next;
}

export async function getMediaStats(): Promise<{ total: number; images: number; videos: number; pdfs: number; documents: number; totalSize: number; optimizedCount: number }> {
  const all = await readAll();
  return { total: all.length, images: all.filter(record => record.type === 'image').length, videos: all.filter(record => record.type === 'video').length, pdfs: all.filter(record => record.type === 'pdf').length, documents: all.filter(record => record.type === 'document').length, totalSize: all.reduce((sum, record) => sum + record.size, 0), optimizedCount: all.filter(record => record.optimized).length };
}
export async function getFolders(): Promise<string[]> { return [...new Set((await readAll()).map(record => record.folder))].sort(); }
export async function getAllTags(): Promise<string[]> { return [...new Set((await readAll()).flatMap(record => record.tags))].sort(); }
