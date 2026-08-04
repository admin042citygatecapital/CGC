/**
 * POST /api/users/kyc/upload-url
 *
 * Reworked against the current backend: the original implementation asked
 * Supabase Storage for a signed direct-upload URL (createKycUploadUrl) for
 * an arbitrary, unbounded set of named documents per user. The current data
 * model (UserRecord in userStore.ts) only tracks two KYC document slots —
 * `idDocumentUrl` and `selfieUrl` — and the storage backend (r2Storage.ts,
 * Cloudflare R2) does server-side upload rather than issuing signed PUT
 * URLs, so this now takes the file data directly in the request body,
 * uploads it via R2 (or the local-filesystem fallback), and persists the
 * resulting URL onto the matching user field.
 *
 * Body: { docType: 'id' | 'selfie', filename: string, fileData: string
 *   (base64, optionally data-URL-prefixed), mimeType: string }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import { uploadMedia } from '../../../../lib/r2Storage.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid session' });

  const { docType, filename, fileData, mimeType } = req.body as {
    docType?: string; filename?: string; fileData?: string; mimeType?: string;
  };
  if (docType !== 'id' && docType !== 'selfie') {
    return res.status(400).json({ ok: false, error: "docType must be 'id' or 'selfie'" });
  }
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ ok: false, error: 'filename is required' });
  }
  if (!fileData || typeof fileData !== 'string') {
    return res.status(400).json({ ok: false, error: 'fileData is required' });
  }
  if (!mimeType || typeof mimeType !== 'string') {
    return res.status(400).json({ ok: false, error: 'mimeType is required' });
  }

  const base64 = fileData.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return res.status(400).json({ ok: false, error: 'File must be between 1 byte and 10 MB' });
  }

  // saveToLocal() (the non-R2 fallback in r2Storage.ts) does a flat
  // fs.writeFileSync with no intermediate mkdir, so the key must not
  // contain "/" — keep everything in one path segment.
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
  const key = `kyc_${docType}_${user.id}_${Date.now()}_${safeName}`;

  try {
    const { url } = await uploadMedia(key, buffer, mimeType);
    const field = docType === 'id' ? 'idDocumentUrl' : 'selfieUrl';
    await updateUser(user.id, { [field]: url } as never);
    appendAudit({ event: 'user_kyc_document_uploaded', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { docType } });
    return res.json({ ok: true, url, docType });
  } catch (err) {
    console.error('[kyc/upload-url] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to upload document' });
  }
}
