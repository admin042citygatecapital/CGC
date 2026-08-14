import type { Request, Response } from 'express';
import { readHomepageDocument, readHomepageHistory } from '../../../../lib/homepageCmsStore.js';

export default async function handler(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  const [document, history] = await Promise.all([readHomepageDocument(), readHomepageHistory()]);
  res.json({ document, history: history.slice(-20).reverse() });
}
