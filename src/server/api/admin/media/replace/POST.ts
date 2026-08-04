/**
 * POST /api/admin/media/replace
 * Body: { id, fileData: base64, originalName, mimeType }
 * Replaces the file behind an existing media record (same id/url slot
 * conceptually, new filename/content) — see mediaStore.replaceMediaRecord.
 */
import type { Request, Response } from 'express';
import { replaceMediaRecord } from '../../../../lib/mediaStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { id?: string; fileData?: string; originalName?: string; mimeType?: string };
  if (!raw.id || !raw.fileData || !raw.originalName || !raw.mimeType) {
    return res.status(400).json({ ok: false, error: 'id, fileData, originalName, and mimeType are required' });
  }

  const base64 = raw.fileData.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return res.status(400).json({ ok: false, error: 'File must be between 1 byte and 25 MB' });
  }

  const record = replaceMediaRecord(raw.id, {
    originalName: sanitizeString(raw.originalName, 255),
    mimeType: raw.mimeType,
    size: buffer.length,
    buffer,
  });
  if (!record) return res.status(404).json({ ok: false, error: 'Media record not found' });

  appendAudit({ event: 'admin_media_replaced', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: raw.id } });

  return res.json({ ok: true, media: record });
}
