import type { Request, Response } from 'express';
import {
  createMediaRecord, updateMediaRecord, deleteMediaRecord,
  getMedia,
} from '../../../lib/mediaStore.js';
import { uploadMedia, deleteMedia } from '../../../lib/supabaseStorage.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { action } = req.body as { action?: string };

    // ── Delete ────────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { id } = req.body as { id: string };
      if (!id) return res.status(400).json({ error: 'id required' });
      const record = getMedia(id);
      if (record) {
        // Remove from storage (Supabase or local)
        await deleteMedia(record.filename, record.storageKey);
      }
      const ok = deleteMediaRecord(id);
      return res.json({ ok });
    }

    // ── Update metadata ───────────────────────────────────────────────────────
    if (action === 'update') {
      const { id, alt, tags, folder } = req.body as { id: string; alt?: string; tags?: string[]; folder?: string };
      if (!id) return res.status(400).json({ error: 'id required' });
      const rec = updateMediaRecord(id, { alt, tags, folder });
      if (!rec) return res.status(404).json({ error: 'Not found' });
      return res.json(rec);
    }

    // ── Mark optimized ────────────────────────────────────────────────────────
    if (action === 'optimize') {
      const { id } = req.body as { id: string };
      if (!id) return res.status(400).json({ error: 'id required' });
      const rec = getMedia(id);
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

    const buffer = Buffer.from(dataBase64, 'base64');

    // Upload to Supabase Storage (or local fallback)
    const timestamp = Date.now();
    const safeName  = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename  = `${timestamp}-${safeName}`;
    const { url, storage, storageKey } = await uploadMedia(filename, buffer, mimeType, 'cgc-media', 'media');

    const record = createMediaRecord({
      originalName,
      mimeType,
      size: buffer.length,
      buffer,
      url,
      storageKey: storage === 'supabase' ? storageKey : undefined,
      alt,
      tags,
      folder,
      width,
      height,
      uploadedBy: 'admin',
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: 'Media operation failed', message: String(err) });
  }
}
