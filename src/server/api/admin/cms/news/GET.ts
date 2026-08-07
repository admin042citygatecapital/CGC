import type { Request, Response } from 'express';
import { getNews } from '../../../../lib/cmsExtStore.js';
export default function handler(req: Request, res: Response) {
  const { status, category, search, page, limit } = req.query as Record<string, string>;
  res.json(getNews({ status, category, search, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 20 }));
}
