/**
 * POST /api/users/profile/avatar-url
 *
 * Reworked against the current backend: the original implementation asked
 * Supabase Storage for a signed direct-upload URL (createAvatarUploadUrl)
 * that the client would then PUT to itself. The current storage backend,
 * r2Storage.ts, doesn't expose that flow (Cloudflare R2 here is a public
 * bucket with server-side upload only — see uploadMedia()), so this now
 * takes the file data directly in the request body, uploads it via R2 (or
 * the local-filesystem fallback when R2 isn't configured), and persists the
 * resulting URL onto the user's `avatarUrl` field.
 *
 * Body: { filename: string, fileData: string (base64, optionally
 *   data-URL-prefixed), mimeType: string }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import { uploadMedia } from '../../../../lib/r2Storage.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MiB

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid session' });

  const { filename, fileData, mimeType } = req.body as {
    filename?: string; fileData?: string; mimeType?: string;
  };
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ ok: false, error: 'filename is required' });
  }
  if (!fileData || typeof fileData !== 'string') {
    return res.status(400).json({ ok: false, error: 'fileData is required' });
  }
  if (!mimeType || !mimeType.startsWith('image/')) {
    return res.status(400).json({ ok: false, error: 'mimeType must be an image type' });
  }

  const base64 = fileData.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return res.status(400).json({ ok: false, error: 'File must be between 1 byte and 5 MB' });
  }

  // saveToLocal() (the non-R2 fallback in r2Storage.ts) does a flat
  // fs.writeFileSync with no intermediate mkdir, so the key must not
  // contain "/" — keep everything in one path segment.
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
  const key = `avatar_${user.id}_${Date.now()}_${safeName}`;

  try {
    const { url } = await uploadMedia(key, buffer, mimeType);
    await updateUser(user.id, { avatarUrl: url } as never);
    appendAudit({ event: 'user_avatar_updated', userId: user.id, email: user.email, ip: req.ip ?? 'unknown' });
    return res.json({ ok: true, url });
  } catch (err) {
    console.error('[profile/avatar-url] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to upload avatar' });
  }
}
