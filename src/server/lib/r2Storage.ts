/**
 * r2Storage.ts — Cloudflare R2 object storage integration
 *
 * Provides a drop-in replacement for local filesystem media storage.
 * When R2 credentials are configured, uploads go to R2 via the S3-compatible
 * REST API (using Node.js built-in `node:https` — no SDK required).
 * When not configured, falls back to local /shared-storage/public/assets/media/.
 *
 * Required secrets (all optional — falls back to local storage if absent):
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME       — bucket name (default: cgc-media)
 *   R2_PUBLIC_URL        — public base URL (e.g. https://media.citygate.capital)
 *
 * Install guide:
 *   1. Create an R2 bucket in Cloudflare Dashboard → R2
 *   2. Create an API token with Object Read & Write on the bucket
 *   3. Add the five secrets above via Settings → Secrets
 *   4. Enable public access on the bucket and set R2_PUBLIC_URL
 */

import fs     from 'node:fs';
import path   from 'node:path';
import https  from 'node:https';
import crypto from 'node:crypto';
import { getSecret } from '#airo/secrets';

// ── Config ────────────────────────────────────────────────────────────────────

interface R2Config {
  accountId:       string;
  accessKeyId:     string;
  secretAccessKey: string;
  bucketName:      string;
  publicUrl:       string;
}

function getR2Config(): R2Config | null {
  const accountId       = String(getSecret('R2_ACCOUNT_ID')        || '').trim();
  const accessKeyId     = String(getSecret('R2_ACCESS_KEY_ID')     || '').trim();
  const secretAccessKey = String(getSecret('R2_SECRET_ACCESS_KEY') || '').trim();
  const bucketName      = String(getSecret('R2_BUCKET_NAME')       || 'cgc-media').trim();
  const publicUrl       = String(getSecret('R2_PUBLIC_URL')        || '').trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) return null;
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

/** Returns true if R2 is configured and should be used */
export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

/** Returns the configured storage backend name for diagnostics */
export function getStorageBackend(): 'r2' | 'local' {
  return isR2Configured() ? 'r2' : 'local';
}

// ── AWS Signature V4 (for R2 S3-compatible API) ───────────────────────────────

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate    = hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion  = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

interface SignedHeaders {
  Authorization: string;
  'x-amz-date': string;
  'x-amz-content-sha256': string;
  'Content-Type': string;
  Host: string;
}

function signRequest(
  method:      string,
  host:        string,
  path:        string,
  accessKey:   string,
  secretKey:   string,
  body:        Buffer,
  contentType: string,
): SignedHeaders {
  const region  = 'auto';
  const service = 's3';
  const now     = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method,
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest)),
  ].join('\n');

  const signingKey = getSigningKey(secretKey, dateStamp, region, service);
  const signature  = hmacSha256(signingKey, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization:          authorization,
    'x-amz-date':           amzDate,
    'x-amz-content-sha256': payloadHash,
    'Content-Type':         contentType,
    Host:                   host,
  };
}

// ── R2 HTTP operations ────────────────────────────────────────────────────────

function r2Request(
  method:  string,
  cfg:     R2Config,
  key:     string,
  body:    Buffer,
  mime:    string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const host    = `${cfg.accountId}.r2.cloudflarestorage.com`;
    const urlPath = `/${cfg.bucketName}/${key}`;
    const headers = signRequest(method, host, urlPath, cfg.accessKeyId, cfg.secretAccessKey, body, mime);

    const req = https.request(
      {
        hostname: host,
        path:     urlPath,
        method,
        headers:  { ...headers, 'Content-Length': body.length },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`R2 ${method} failed: HTTP ${res.statusCode} — ${data}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Upload a buffer to R2.
 * Returns the public URL of the uploaded object.
 */
export async function uploadToR2(
  key:      string,
  buffer:   Buffer,
  mimeType: string,
): Promise<{ url: string; key: string }> {
  const cfg = getR2Config();
  if (!cfg) throw new Error('R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL');

  await r2Request('PUT', cfg, key, buffer, mimeType);

  const url = `${cfg.publicUrl.replace(/\/$/, '')}/${key}`;
  return { url, key };
}

/**
 * Delete an object from R2 by key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const cfg = getR2Config();
  if (!cfg) return;
  await r2Request('DELETE', cfg, key, Buffer.alloc(0), 'application/octet-stream');
}

// ── Local filesystem fallback ─────────────────────────────────────────────────

const LOCAL_ASSET_DIR = '/shared-storage/public/assets/media';

/**
 * Save a buffer to local filesystem (fallback when R2 is not configured).
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
 * Upload media — uses R2 if configured, local filesystem otherwise.
 * Returns the public URL.
 */
export async function uploadMedia(
  filename: string,
  buffer:   Buffer,
  mimeType: string,
): Promise<{ url: string; storage: 'r2' | 'local' }> {
  if (isR2Configured()) {
    const { url } = await uploadToR2(`media/${filename}`, buffer, mimeType);
    return { url, storage: 'r2' };
  }
  const { url } = saveToLocal(filename, buffer);
  return { url, storage: 'local' };
}

/**
 * Delete media — uses R2 if configured, local filesystem otherwise.
 */
export async function deleteMedia(
  filename: string,
  r2Key?:   string,
): Promise<void> {
  if (isR2Configured()) {
    await deleteFromR2(r2Key ?? `media/${filename}`);
  } else {
    deleteFromLocal(filename);
  }
}
