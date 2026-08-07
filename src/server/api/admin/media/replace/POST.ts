import type { Request, Response } from 'express';
import { replaceMediaRecord, getMedia } from '../../../../lib/mediaStore.js';
import { uploadMedia, deleteMedia } from '../../../../lib/supabaseStorage.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { id, originalName, mimeType, dataBase64 } =
      req.body as { id: string; originalName: string; mimeType: string; dataBase64: string };

    if (!id || !originalName || !mimeType || !dataBase64) {
      return res.status(400).json({ error: 'id, originalName, mimeType and dataBase64 are required' });
    }

    // Delete old object from storage before replacing
    const existing = getMedia(id);
    if (existing) {
      await deleteMedia(existing.filename, existing.storageKey);
    }

    const buffer    = Buffer.from(dataBase64, 'base64');
    const timestamp = Date.now();
    const safeName  = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename  = `${timestamp}-${safeName}`;

    // Upload replacement to Supabase Storage (or local fallback)
    const { url, storage, storageKey } = await uploadMedia(filename, buffer, mimeType, 'cgc-media', 'media');

    const record = replaceMediaRecord(id, {
      originalName,
      mimeType,
      size:       buffer.length,
      buffer,
      url,
      storageKey: storage === 'supabase' ? storageKey : undefined,
    });

    if (!record) return res.status(404).json({ error: 'Media record not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Replace failed', message: String(err) });
  }
}
