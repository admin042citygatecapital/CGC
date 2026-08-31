import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSecret } from '#runtime/secrets';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export const KYC_BUCKET = 'cgc-kyc-private';
export const MAX_KYC_DOCUMENT_BYTES = 5 * 1024 * 1024;
export type KycMimeType = 'image/jpeg' | 'image/png' | 'application/pdf';

let cachedClient: SupabaseClient | null = null;

function storageClient(): SupabaseClient {
  const url = String(getSecret('SUPABASE_URL') ?? '').trim();
  const key = String(getSecret('SUPABASE_SERVICE_ROLE_KEY') ?? getSecret('SUPABASE_SECRET_KEY') ?? '').trim();
  if (!url || !key) throw Object.assign(new Error('Private KYC storage is not configured.'), { code: 'KYC_STORAGE_UNAVAILABLE' });
  cachedClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cachedClient;
}

export async function ensurePrivateKycBucket(): Promise<void> {
  const client = storageClient();
  const { data, error } = await client.storage.getBucket(KYC_BUCKET);
  if (!error && data) {
    if (data.public) throw Object.assign(new Error('The KYC storage bucket must be private.'), { code: 'KYC_BUCKET_PUBLIC' });
    return;
  }
  if (error && !/not found/i.test(error.message)) throw new Error(`KYC storage check failed: ${error.message}`);
  const created = await client.storage.createBucket(KYC_BUCKET, {
    public: false,
    fileSizeLimit: MAX_KYC_DOCUMENT_BYTES,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  });
  if (created.error) throw new Error(`KYC storage bucket creation failed: ${created.error.message}`);
}

export function createKycObjectKey(caseId: string, documentId: string, mimeType: KycMimeType): string {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'pdf';
  const caseSegment = crypto.createHash('sha256').update(caseId).digest('hex').slice(0, 24);
  return `cases/${caseSegment}/${documentId}.${extension}`;
}

export async function uploadPrivateKycObject(key: string, bytes: Buffer, mimeType: KycMimeType): Promise<void> {
  await ensurePrivateKycBucket();
  const { error } = await storageClient().storage.from(KYC_BUCKET).upload(key, bytes, {
    contentType: mimeType,
    cacheControl: '0',
    upsert: false,
  });
  if (error) throw new Error(`KYC document upload failed: ${error.message}`);
}

export async function downloadPrivateKycObject(key: string): Promise<Buffer> {
  const { data, error } = await storageClient().storage.from(KYC_BUCKET).download(key);
  if (error || !data) throw Object.assign(new Error('KYC document is unavailable.'), { code: 'KYC_DOCUMENT_UNAVAILABLE' });
  return Buffer.from(await data.arrayBuffer());
}

export async function deletePrivateKycObject(key: string): Promise<void> {
  const { error } = await storageClient().storage.from(KYC_BUCKET).remove([key]);
  if (error) throw new Error(`KYC document cleanup failed: ${error.message}`);
}

export async function validateAndSanitizeKycDocument(input: Buffer, contentType: string): Promise<{ bytes: Buffer; mimeType: KycMimeType }> {
  if (input.length === 0 || input.length > MAX_KYC_DOCUMENT_BYTES) throw new Error('Document must be between 1 byte and 5 MB.');
  if (contentType === 'image/jpeg' || contentType === 'image/png') {
    try {
      let bytes: Buffer;
      if (contentType === 'image/jpeg') {
        if (input[0] !== 0xff || input[1] !== 0xd8) throw new Error('File signature does not match its declared image type.');
        const decoded = jpeg.decode(input, { useTArray: true, maxMemoryUsageInMB: 128, maxResolutionInMP: 25 });
        bytes = Buffer.from(jpeg.encode(decoded, 92).data);
      } else {
        const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        if (input.length < 24 || !input.subarray(0, 8).equals(signature)) throw new Error('File signature does not match its declared image type.');
        const width = input.readUInt32BE(16);
        const height = input.readUInt32BE(20);
        if (!width || !height || width * height > 25_000_000) throw new Error('Image dimensions exceed the safe processing limit.');
        const decoded = PNG.sync.read(input, { checkCRC: true });
        bytes = PNG.sync.write(decoded, { colorType: 6, inputColorType: 6 });
      }
      if (bytes.length > MAX_KYC_DOCUMENT_BYTES) throw new Error('Sanitized image exceeds the 5 MB limit.');
      return { bytes, mimeType: contentType };
    } catch (error) {
      throw new Error(`Malformed image document: ${error instanceof Error ? error.message : 'decode failed'}`);
    }
  }
  if (contentType === 'application/pdf') {
    const head = input.subarray(0, 8).toString('ascii');
    const tail = input.subarray(Math.max(0, input.length - 1024)).toString('latin1');
    const body = input.toString('latin1');
    if (!head.startsWith('%PDF-') || !tail.includes('%%EOF')) throw new Error('Malformed PDF document.');
    if (/\/(Encrypt|JavaScript|JS|Launch|EmbeddedFile|XFA|OpenAction|AA)\b/.test(body)) throw new Error('Active or encrypted PDF content is not accepted.');
    return { bytes: input, mimeType: 'application/pdf' };
  }
  throw new Error('Only JPEG, PNG, and PDF documents are accepted.');
}

export function sanitizeOriginalFilename(value: string, mimeType: KycMimeType): string {
  const extension = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.pdf';
  const base = value.replaceAll('\\', '/').split('/').at(-1)?.replace(/[^A-Za-z0-9._ -]/g, '').trim().slice(0, 100) ?? '';
  return base && base.toLowerCase().endsWith(extension) ? base : `document${extension}`;
}
