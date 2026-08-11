import type { Request, Response } from 'express';
import { readHomepageDocument, readHomepageHistory } from '../../../../lib/homepageCmsStore.js';

export default function handler(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ document: readHomepageDocument(), history: readHomepageHistory().slice(-20).reverse() });
}

