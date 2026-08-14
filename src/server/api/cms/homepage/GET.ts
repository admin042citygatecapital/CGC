import type { Request, Response } from 'express';
import { readHomepageDocument } from '../../../lib/homepageCmsStore.js';

export default async function handler(_req: Request, res: Response) {
  const document = await readHomepageDocument();
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  res.setHeader('ETag', `"${document.hash}"`);
  res.json({ version: document.version, updatedAt: document.updatedAt, content: document.content });
}
