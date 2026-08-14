/**
 * POST /api/users/avatar
 * Accepts a base64-encoded image and stores it via Supabase Storage.
 * Local storage is restricted to development because release filesystems are
 * ephemeral and must never be acknowledged as durable customer storage.
 * Body: { avatarBase64: "data:image/jpeg;base64,..." }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../lib/userStore.js';
import { uploadToSupabase, isSupabaseStorageConfigured, saveToLocal } from '../../../lib/supabaseStorage.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const managedStorageAvailable = isSupabaseStorageConfigured();
  if (process.env.NODE_ENV === 'production' && !managedStorageAvailable) {
    return res.status(503).json({
      error: 'Profile image storage is temporarily unavailable.',
      code: 'MANAGED_STORAGE_REQUIRED',
    });
  }

  const { avatarBase64 } = req.body ?? {};
  if (!avatarBase64) return res.status(400).json({ error: 'avatarBase64 is required' });

  // Validate it's a data URI
  const match = String(avatarBase64).match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Invalid image format. Must be a base64 data URI (JPEG, PNG, GIF, or WebP).' });

  const [, mimeType, b64data] = match;
  const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');

  // Size check (~2MB max)
  const byteSize = Math.ceil(b64data.length * 0.75);
  if (byteSize > 2 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image too large. Maximum size is 2MB.' });
  }

  try {
    const buffer   = Buffer.from(b64data, 'base64');
    const filename = `${user.id}.${ext}`;
    let avatarUrl: string;

    if (managedStorageAvailable) {
      // Use dedicated 'avatars' bucket — public, 5 MB limit
      const { url } = await uploadToSupabase(`${user.id}.${ext}`, buffer, mimeType, 'avatars');
      avatarUrl = url;
    } else {
      // Local fallback — write to shared-storage
      const { url } = saveToLocal(`../uploads/avatars/${filename}`, buffer);
      avatarUrl = `/airo-assets/uploads/avatars/${filename}`;
      void url; // saveToLocal returns the media path; we override for avatars
    }

    await updateUser(user.id, { avatarUrl } as Parameters<typeof updateUser>[1]);
    return res.json({ ok: true, avatarUrl });
  } catch (err) {
    console.error('avatar.upload.failed', {
      userId: user.id,
      errorType: err instanceof Error ? err.name : 'UnknownError',
    });
    return res.status(500).json({ error: 'Failed to save profile image.' });
  }
}
