const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'application/pdf',
]);
const ALLOWED_EXTENSIONS: Record<string, Set<string>> = {
  'image/jpeg': new Set(['jpg', 'jpeg']),
  'image/png': new Set(['png']),
  'image/webp': new Set(['webp']),
  'image/gif': new Set(['gif']),
  'video/mp4': new Set(['mp4']),
  'application/pdf': new Set(['pdf']),
};

function hasSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mimeType === 'image/gif') return buffer.length >= 6 && ['GIF87a','GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mimeType === 'application/pdf') return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'video/mp4') return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  return false;
}

export function validateMediaUpload(input: { originalName: unknown; mimeType: unknown; dataBase64: unknown }): { originalName: string; mimeType: string; buffer: Buffer } {
  const originalName = String(input.originalName ?? '').trim();
  const mimeType = String(input.mimeType ?? '').trim().toLowerCase();
  const dataBase64 = String(input.dataBase64 ?? '').trim();
  if (!originalName || originalName.length > 180 || /[\\/\0]/.test(originalName)) throw new Error('INVALID_MEDIA_NAME');
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error('UNSUPPORTED_MEDIA_TYPE');
  const extension = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS[mimeType]?.has(extension)) throw new Error('MEDIA_EXTENSION_MISMATCH');
  if (!dataBase64 || dataBase64.length % 4 !== 0 || dataBase64.length > Math.ceil(MAX_MEDIA_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) throw new Error('INVALID_MEDIA_DATA');
  const buffer = Buffer.from(dataBase64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_MEDIA_BYTES) throw new Error('MEDIA_SIZE_INVALID');
  if (!hasSignature(buffer, mimeType)) throw new Error('MEDIA_SIGNATURE_MISMATCH');
  return { originalName, mimeType, buffer };
}

export function validateMediaMetadata(input: { alt?: unknown; tags?: unknown; folder?: unknown; width?: unknown; height?: unknown }): {
  alt?: string; tags?: string[]; folder?: string; width?: number; height?: number;
} {
  const result: { alt?: string; tags?: string[]; folder?: string; width?: number; height?: number } = {};
  if (input.alt !== undefined) {
    if (typeof input.alt !== 'string' || input.alt.length > 300) throw new Error('INVALID_MEDIA_METADATA');
    result.alt = input.alt.trim();
  }
  if (input.folder !== undefined) {
    if (typeof input.folder !== 'string' || input.folder.length > 80 || /[\\/\0]/.test(input.folder)) throw new Error('INVALID_MEDIA_METADATA');
    result.folder = input.folder.trim() || 'uncategorized';
  }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.length > 20 || input.tags.some(tag => typeof tag !== 'string' || tag.length > 40)) throw new Error('INVALID_MEDIA_METADATA');
    result.tags = [...new Set(input.tags.map(tag => tag.trim()).filter(Boolean))];
  }
  for (const field of ['width', 'height'] as const) {
    const value = input[field];
    if (value === undefined || value === null) continue;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 100_000) throw new Error('INVALID_MEDIA_METADATA');
    result[field] = Number(value);
  }
  return result;
}

export function validateMediaAssignment(input: { pageKey?: unknown; slotKey?: unknown; cropX?: unknown; cropY?: unknown; cropZoom?: unknown; cropAspect?: unknown }): {
  pageKey: string; slotKey: string; cropX: number; cropY: number; cropZoom: number; cropAspect: 'original' | 'square' | 'portrait' | 'landscape' | 'wide';
} {
  const pageKey = String(input.pageKey ?? '').trim().toLowerCase();
  const slotKey = String(input.slotKey ?? '').trim().toLowerCase();
  const cropX = input.cropX === undefined ? 50 : Number(input.cropX);
  const cropY = input.cropY === undefined ? 50 : Number(input.cropY);
  const cropZoom = input.cropZoom === undefined ? 1 : Number(input.cropZoom);
  const cropAspect = String(input.cropAspect ?? 'original') as 'original' | 'square' | 'portrait' | 'landscape' | 'wide';
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(pageKey) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slotKey)) throw new Error('INVALID_MEDIA_ASSIGNMENT');
  if (!Number.isInteger(cropX) || cropX < 0 || cropX > 100 || !Number.isInteger(cropY) || cropY < 0 || cropY > 100) throw new Error('INVALID_MEDIA_ASSIGNMENT');
  if (!Number.isFinite(cropZoom) || cropZoom < 1 || cropZoom > 4) throw new Error('INVALID_MEDIA_ASSIGNMENT');
  if (!['original', 'square', 'portrait', 'landscape', 'wide'].includes(cropAspect)) throw new Error('INVALID_MEDIA_ASSIGNMENT');
  return { pageKey, slotKey, cropX, cropY, cropZoom: Math.round(cropZoom * 100) / 100, cropAspect };
}

export function safeMediaError(error: unknown): { status: number; message: string } {
  const code = error instanceof Error ? error.message : '';
  if (code === 'INVALID_MEDIA_NAME') return { status: 400, message: 'Choose a valid filename.' };
  if (code === 'UNSUPPORTED_MEDIA_TYPE') return { status: 415, message: 'Use a JPEG, PNG, WebP, GIF, MP4, or PDF file.' };
  if (code === 'MEDIA_EXTENSION_MISMATCH') return { status: 400, message: 'The filename does not match the verified file type.' };
  if (code === 'INVALID_MEDIA_METADATA') return { status: 400, message: 'Check the media description, folder, tags, and dimensions.' };
  if (code === 'INVALID_MEDIA_ASSIGNMENT') return { status: 400, message: 'Check the page, section, and crop settings.' };
  if (code === 'MEDIA_IN_USE') return { status: 409, message: 'Remove this asset from its assigned page sections before deleting it.' };
  if (code === 'MEDIA_NOT_FOUND') return { status: 404, message: 'The selected media asset was not found.' };
  if (code === 'MEDIA_SIZE_INVALID') return { status: 413, message: 'Media files must be no larger than 10 MB.' };
  if (code === 'INVALID_MEDIA_DATA' || code === 'MEDIA_SIGNATURE_MISMATCH') return { status: 400, message: 'The uploaded file could not be verified.' };
  return { status: 500, message: 'The media operation could not be completed.' };
}
