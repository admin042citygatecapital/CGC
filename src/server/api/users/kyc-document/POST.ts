/**
 * POST /api/users/kyc-document
 * Accepts a base64-encoded ID document image and saves it via Supabase Storage (or local fallback).
 * Called right after registration — no auth token yet, so userId is passed in body.
 * The document URL is stored on the user record for admin review.
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { findUserById, updateUser } from '../../../lib/userStore.js';
import { uploadToSupabase, isSupabaseStorageConfigured } from '../../../lib/supabaseStorage.js';

const LOCAL_KYC_DIR = '/shared-storage/public/assets/uploads/kyc';

export default async function handler(req: Request, res: Response) {
  const { userId, documentBase64 } = req.body as { userId?: string; documentBase64?: string };

  if (!userId || !documentBase64) {
    return res.status(400).json({ error: 'userId and documentBase64 are required' });
  }

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Parse base64 data URL: "data:image/jpeg;base64,/9j/..."
  const match = documentBase64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Invalid base64 image format' });

  const [, mimeType, b64Data] = match;
  const ext      = mimeType.split('/')[1] ?? 'jpg';
  const filename = `${userId}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const buffer   = Buffer.from(b64Data, 'base64');

  let docUrl: string;

  try {
    if (isSupabaseStorageConfigured()) {
      // Use dedicated 'kyc-docs' bucket — private, 10 MB limit
      const { url } = await uploadToSupabase(filename, buffer, mimeType, 'kyc-docs');
      docUrl = url;
    } else {
      // Local fallback
      fs.mkdirSync(LOCAL_KYC_DIR, { recursive: true });
      fs.writeFileSync(path.join(LOCAL_KYC_DIR, filename), buffer);
      docUrl = `/airo-assets/uploads/kyc/${filename}`;
    }
  } catch (err) {
    console.error('kyc-document.write.failed', err);
    return res.status(500).json({ error: 'Failed to save document' });
  }

  await updateUser(userId, {
    idDocumentUrl:   docUrl,
    kycStatus:       'submitted',
    kycSubmittedAt:  new Date().toISOString(),
  } as Parameters<typeof updateUser>[1]);

  return res.json({ ok: true, url: docUrl });
}
