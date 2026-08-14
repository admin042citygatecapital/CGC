import type { Request, Response } from 'express';
import { replaceMediaRecord, getMedia } from '../../../../lib/mediaStore.js';
import { uploadMedia, deleteMedia } from '../../../../lib/supabaseStorage.js';
import { safeMediaError, validateMediaUpload } from '../../../../lib/mediaValidation.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { id, originalName, mimeType, dataBase64 } =
      req.body as { id: string; originalName: string; mimeType: string; dataBase64: string };

    if (!id || !originalName || !mimeType || !dataBase64) {
      return res.status(400).json({ error: 'id, originalName, mimeType and dataBase64 are required' });
    }

    // Delete old object from storage before replacing
    const existing = await getMedia(id);
    if (!existing) return res.status(404).json({ error: 'Media record not found' });

    const validated = validateMediaUpload({ originalName, mimeType, dataBase64 });
    const buffer    = validated.buffer;
    const timestamp = Date.now();
    const safeName  = validated.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename  = `${timestamp}-${safeName}`;

    // Upload replacement to Supabase Storage (or local fallback)
    const { url, storage, storageKey } = await uploadMedia(filename, buffer, validated.mimeType, undefined, 'media');

    let record;
    try {
      record = await replaceMediaRecord(id, {
        originalName: validated.originalName,
        mimeType: validated.mimeType,
        size:       buffer.length,
        buffer,
        url,
        storageKey: storage === 'supabase' ? storageKey : undefined,
      });
    } catch (error) {
      await deleteMedia(filename, storage === 'supabase' ? storageKey : undefined).catch(() => undefined);
      throw error;
    }

    if (!record) return res.status(404).json({ error: 'Media record not found' });
    await deleteMedia(existing.filename, existing.storageKey);
    res.json(record);
  } catch (error) {
    const safe = safeMediaError(error);
    console.error('admin.media.replace.failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    res.status(safe.status).json({ error: safe.message });
  }
}
