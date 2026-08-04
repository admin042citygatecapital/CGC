/**
 * POST /api/admin/media
 * Body: { fileData: string (base64, optionally data-URL-prefixed),
 *         originalName: string, mimeType: string, alt?, tags?, folder? }
 * No multipart/form-data middleware is configured anywhere in this
 * codebase, so uploads travel as base64 — same convention used by
 * users/profile/avatar-url and users/kyc/upload-url.
 */
import type { Request, Response } from 'express';
import { createMediaRecord } from '../../../lib/mediaStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sanitizeString } from '../../../lib/inputValidator.js';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB

export default async function handler(req: Request, res: Response) {
  const raw = req.body as {
    fileData?: string; originalName?: string; mimeType?: string;
    alt?: string; tags?: unknown; folder?: string;
  };

  if (!raw.fileData || !raw.originalName || !raw.mimeType) {
    return res.status(400).json({ ok: false, error: 'fileData, originalName, and mimeType are required' });
  }

  const base64 = raw.fileData.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return res.status(400).json({ ok: false, error: 'File must be between 1 byte and 25 MB' });
  }

  const record = createMediaRecord({
    originalName: sanitizeString(raw.originalName, 255),
    mimeType: raw.mimeType,
    size: buffer.length,
    buffer,
    alt: raw.alt ? sanitizeString(raw.alt, 500) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string').map(t => sanitizeString(t, 50)) : undefined,
    folder: raw.folder ? sanitizeString(raw.folder, 100) : undefined,
    uploadedBy: req.adminSession?.email,
  });

  appendAudit({ event: 'admin_media_uploaded', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: record.id } });

  return res.status(201).json({ ok: true, media: record });
}
