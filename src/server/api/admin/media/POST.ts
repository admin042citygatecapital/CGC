import type { Request, Response } from 'express';
import {
  createMediaRecord, updateMediaRecord, deleteMediaRecord,
  getMedia,
} from '../../../lib/mediaStore.js';
import { uploadMedia, deleteMedia } from '../../../lib/supabaseStorage.js';
import { safeMediaError, validateMediaMetadata, validateMediaUpload } from '../../../lib/mediaValidation.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { action } = req.body as { action?: string };

    // ── Delete ────────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { id } = req.body as { id: string };
      if (!id) return res.status(400).json({ error: 'id required' });
      const record = await getMedia(id);
      if (record) {
        await deleteMedia(record.filename, record.storageKey);
        await deleteMediaRecord(id);
      }
      return res.json({ ok: Boolean(record) });
    }

    // ── Update metadata ───────────────────────────────────────────────────────
    if (action === 'update') {
      const { id, alt, tags, folder } = req.body as { id: string; alt?: string; tags?: string[]; folder?: string };
      if (!id) return res.status(400).json({ error: 'id required' });
      const metadata = validateMediaMetadata({ alt, tags, folder });
      const rec = await updateMediaRecord(id, metadata);
      if (!rec) return res.status(404).json({ error: 'Not found' });
      return res.json(rec);
    }

    // ── Mark optimized ────────────────────────────────────────────────────────
    if (action === 'optimize') {
      const { id } = req.body as { id: string };
      if (!id) return res.status(400).json({ error: 'id required' });
      const rec = await getMedia(id);
      if (!rec) return res.status(404).json({ error: 'Not found' });
      return res.status(501).json({
        error: 'Media optimization is not configured. The original file was not changed.',
        code: 'OPTIMIZER_NOT_CONFIGURED',
      });
    }

    // ── Upload (base64 payload) ───────────────────────────────────────────────
    const { originalName, mimeType, dataBase64, alt, tags, folder, width, height } =
      req.body as {
        originalName: string; mimeType: string; dataBase64: string;
        alt?: string; tags?: string[]; folder?: string;
        width?: number; height?: number;
      };

    if (!originalName || !mimeType || !dataBase64) {
      return res.status(400).json({ error: 'originalName, mimeType and dataBase64 are required' });
    }

    const validated = validateMediaUpload({ originalName, mimeType, dataBase64 });
    const metadata = validateMediaMetadata({ alt, tags, folder, width, height });
    const buffer = validated.buffer;

    // Upload to Supabase Storage (or local fallback)
    const timestamp = Date.now();
    const safeName  = validated.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename  = `${timestamp}-${safeName}`;
    const { url, storage, storageKey } = await uploadMedia(filename, buffer, validated.mimeType, undefined, 'media');

    let record;
    try {
      record = await createMediaRecord({
        originalName: validated.originalName,
        mimeType: validated.mimeType,
        size: buffer.length,
        buffer,
        url,
        storageKey: storage === 'supabase' ? storageKey : undefined,
        ...metadata,
        uploadedBy: req.adminSession?.adminId ?? 'admin',
      });
    } catch (error) {
      await deleteMedia(filename, storage === 'supabase' ? storageKey : undefined).catch(() => undefined);
      throw error;
    }

    res.status(201).json(record);
  } catch (error) {
    const safe = safeMediaError(error);
    console.error('admin.media.operation.failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    res.status(safe.status).json({ error: safe.message });
  }
}
