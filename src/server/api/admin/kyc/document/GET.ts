import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { privateSubdirectory } from '../../../../lib/storagePaths.js';

const directory = privateSubdirectory('kyc-documents');
const contentTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export default function handler(req: Request, res: Response) {
  const userId = String(req.query.userId ?? '');
  const kind = String(req.query.kind ?? 'id');
  if (!/^usr_[a-f0-9]{16}$/i.test(userId) || (kind !== 'id' && kind !== 'selfie')) {
    return res.status(400).json({ error: 'Invalid document request' });
  }

  const prefix = `${userId}-${kind}-`;
  const filename = fs.existsSync(directory)
    ? fs.readdirSync(directory).find(file => file.startsWith(prefix))
    : undefined;
  if (!filename) return res.status(404).json({ error: 'Document not found' });

  const contentType = contentTypes[path.extname(filename).toLowerCase()];
  if (!contentType) return res.status(415).json({ error: 'Unsupported document type' });
  res.set({
    'Content-Type': contentType,
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  return fs.createReadStream(path.join(directory, filename)).pipe(res);
}
