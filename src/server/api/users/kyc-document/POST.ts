import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { findUserById, findUserBySessionToken, updateUser } from '../../../lib/userStore.js';
import { privateSubdirectory } from '../../../lib/storagePaths.js';
import { verifyKycUploadToken } from '../../../lib/purposeToken.js';
import { resolveCustomerSessionToken } from '../../../lib/customerAuthMiddleware.js';

const kycDirectory = privateSubdirectory('kyc-documents');

export default async function handler(req: Request, res: Response) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      error: 'Identity-document collection is unavailable until an approved KYC provider is integrated.',
      code: 'KYC_PROVIDER_REQUIRED',
    });
  }

  const { userId, documentBase64, documentKind = 'id' } = req.body as {
    userId?: string;
    documentBase64?: string;
    documentKind?: 'id' | 'selfie';
  };
  if (!documentBase64) return res.status(400).json({ error: 'documentBase64 is required' });
  if (documentKind !== 'id' && documentKind !== 'selfie') {
    return res.status(400).json({ error: 'documentKind must be id or selfie' });
  }

  const authorization = req.headers.authorization ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const customerToken = resolveCustomerSessionToken(req);
  const sessionUser = customerToken ? await findUserBySessionToken(customerToken) : undefined;
  const authorizedUserId = sessionUser?.id ?? verifyKycUploadToken(bearer);
  if (!authorizedUserId) return res.status(401).json({ error: 'Authentication required' });
  if (userId && userId !== authorizedUserId) return res.status(403).json({ error: 'User mismatch' });

  const user = await findUserById(authorizedUserId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const match = documentBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Invalid base64 image format' });
  const [, mimeType, base64Data] = match;
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'Document must be between 1 byte and 10MB' });
  }

  const prefix = `${authorizedUserId}-${documentKind}-`;
  const filename = `${prefix}${crypto.randomBytes(8).toString('hex')}.${extension}`;
  const documentUrl = `/api/admin/kyc/document?userId=${encodeURIComponent(authorizedUserId)}&kind=${documentKind}`;
  try {
    fs.mkdirSync(kycDirectory, { recursive: true });
    for (const oldFile of fs.readdirSync(kycDirectory).filter(file => file.startsWith(prefix))) {
      fs.unlinkSync(path.join(kycDirectory, oldFile));
    }
    fs.writeFileSync(path.join(kycDirectory, filename), buffer, { mode: 0o600 });
  } catch (error) {
    console.error('kyc-document.write.failed', error);
    return res.status(500).json({ error: 'Failed to save document' });
  }

  await updateUser(authorizedUserId, {
    ...(documentKind === 'id' ? { idDocumentUrl: documentUrl } : { selfieUrl: documentUrl }),
    kycStatus: 'submitted',
    kycSubmittedAt: new Date().toISOString(),
  } as Parameters<typeof updateUser>[1]);
  return res.json({ ok: true, url: documentUrl });
}
