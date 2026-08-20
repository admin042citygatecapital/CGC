/**
 * supabaseStorage.ts — Supabase Storage integration
 *
 * Managed object storage with a development-only local fallback.
 * When Supabase credentials are configured, uploads go to Supabase Storage.
 * Production uploads fail closed when managed storage is unavailable so a
 * deploy cannot silently create objects on an instance-local filesystem.
 *
 * Required secrets (all optional — falls back to local storage if absent):
 *   SUPABASE_URL              — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service_role key (server-side only)
 *   SUPABASE_SECRET_KEY       — newer server secret key alias
 *   SUPABASE_STORAGE_BUCKET   — bucket name (default: cgc-media)
 *
 * The bucket must exist in Supabase Dashboard → Storage.
 * Set the bucket to public if you want direct CDN URLs, or keep it private
 * and use signed URLs (this implementation uses public URLs for simplicity).
 */

import fs   from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSecret } from '#runtime/secrets';
import { mediaDirectory } from './storagePaths.js';

// ── Config ────────────────────────────────────────────────────────────────────

interface StorageConfig {
  supabaseUrl:    string;
  serviceRoleKey: string;
  bucket:         string;
}

function getStorageConfig(): StorageConfig | null {
  const supabaseUrl    = String(getSecret('SUPABASE_URL')          || '').trim();
  const serviceRoleKey = String(
    getSecret('SUPABASE_SERVICE_ROLE_KEY') ||
    getSecret('SUPABASE_SECRET_KEY') ||
    '',
  ).trim();
  const rawBucket      = String(getSecret('SUPABASE_STORAGE_BUCKET') || 'cgc-media').trim();

  // Normalise: if the secret was accidentally set to a full URL
  // (e.g. https://xxx.storage.supabase.co/storage/v1/s3), extract just the bucket name.
  // The bucket name is the first path segment after /storage/v1/s3 or /storage/v1/object/...
  // but in practice the user should enter just "cgc-media".  We handle the full-URL case
  // gracefully by defaulting to "cgc-media" when the value looks like a URL.
  let bucket = rawBucket;
  if (rawBucket.startsWith('http://') || rawBucket.startsWith('https://')) {
    // Full URL accidentally saved — fall back to the known default bucket name
    bucket = 'cgc-media';
    console.warn('[supabaseStorage] SUPABASE_STORAGE_BUCKET looks like a URL; using default "cgc-media". Update the secret to just the bucket name.');
  }

  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey, bucket };
}

/** Returns true if Supabase Storage is configured */
export function isSupabaseStorageConfigured(): boolean {
  return getStorageConfig() !== null;
}

/** Returns the configured storage backend name for diagnostics */
export function getStorageBackend(): 'supabase' | 'local' {
  return isSupabaseStorageConfigured() ? 'supabase' : 'local';
}

// ── Supabase client (lazy) ────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;
let _bucket = 'cgc-media';

function getSupabaseClient(): { client: SupabaseClient; bucket: string } | null {
  const cfg = getStorageConfig();
  if (!cfg) return null;

  if (!_client) {
    _client = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
      auth: { persistSession: false },
    });
    _bucket = cfg.bucket;
  }
  return { client: _client, bucket: _bucket };
}

// ── Supabase Storage operations ───────────────────────────────────────────────

/**
 * Upload a buffer to Supabase Storage.
 * Returns the public URL of the uploaded object.
 * @param key         Object key (path inside bucket, e.g. "media/photo.jpg")
 * @param buffer      File contents
 * @param mimeType    MIME type
 * @param bucketOverride  Override the default bucket (optional)
 */
export async function uploadToSupabase(
  key:            string,
  buffer:         Buffer,
  mimeType:       string,
  bucketOverride?: string,
): Promise<{ url: string; key: string }> {
  const ctx = getSupabaseClient();
  if (!ctx) throw new Error('Supabase Storage not configured — set SUPABASE_URL and a server-side Supabase secret key');

  const { client } = ctx;
  const bucket = bucketOverride ?? ctx.bucket;

  const { error } = await client.storage
    .from(bucket)
    .upload(key, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  const { data } = client.storage.from(bucket).getPublicUrl(key);
  return { url: data.publicUrl, key };
}

/**
 * Delete an object from Supabase Storage by key.
 * @param key            Object key (e.g. "media/photo.jpg")
 * @param bucketOverride Override the default bucket (optional)
 */
export async function deleteFromSupabase(key: string, bucketOverride?: string): Promise<void> {
  const ctx = getSupabaseClient();
  if (!ctx) return;

  const { client } = ctx;
  const bucket = bucketOverride ?? ctx.bucket;
  const { error } = await client.storage.from(bucket).remove([key]);
  if (error) throw new Error(`Supabase Storage delete failed: ${error.message}`);
}

// ── Local filesystem fallback ─────────────────────────────────────────────────

const LOCAL_ASSET_DIR = mediaDirectory;

/**
 * Save a buffer to local filesystem (fallback when Supabase is not configured).
 * Returns the public URL path.
 */
export function saveToLocal(
  filename: string,
  buffer:   Buffer,
): { url: string; localPath: string } {
  if (!fs.existsSync(LOCAL_ASSET_DIR)) {
    fs.mkdirSync(LOCAL_ASSET_DIR, { recursive: true });
  }
  const localPath = path.join(LOCAL_ASSET_DIR, filename);
  fs.writeFileSync(localPath, buffer);
  const url = `/airo-assets/uploads/media/${filename}`;
  return { url, localPath };
}

/**
 * Delete a file from local filesystem.
 */
export function deleteFromLocal(filename: string): void {
  const localPath = path.join(LOCAL_ASSET_DIR, filename);
  try {
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  } catch { /* ignore */ }
}

// ── Unified API ───────────────────────────────────────────────────────────────

/**
 * Upload media — uses Supabase Storage if configured, local filesystem otherwise.
 * @param filename  Filename (no path prefix — prefix is added per bucket)
 * @param buffer    File contents
 * @param mimeType  MIME type
 * @param bucket    Supabase bucket to upload to (default: cgc-media)
 * @param keyPrefix Object key prefix inside the bucket (default: 'media')
 */
export async function uploadMedia(
  filename: string,
  buffer:   Buffer,
  mimeType: string,
  bucket?:  string,
  keyPrefix = 'media',
): Promise<{ url: string; storage: 'supabase' | 'local'; storageKey: string }> {
  if (isSupabaseStorageConfigured()) {
    const cfg = getStorageConfig()!;
    const targetBucket = bucket ?? cfg.bucket;
    const key = `${keyPrefix}/${filename}`;
    const { url } = await uploadToSupabase(key, buffer, mimeType, targetBucket);
    return { url, storage: 'supabase', storageKey: key };
  }
  if (process.env.NODE_ENV === 'production') throw new Error('MEDIA_STORAGE_UNAVAILABLE');
  const { url } = saveToLocal(filename, buffer);
  return { url, storage: 'local', storageKey: '' };
}

/**
 * Delete media — uses Supabase Storage if configured, local filesystem otherwise.
 */
export async function deleteMedia(
  filename: string,
  storageKey?: string,
): Promise<void> {
  if (isSupabaseStorageConfigured()) {
    await deleteFromSupabase(storageKey ?? `media/${filename}`);
  } else {
    deleteFromLocal(filename);
  }
}
