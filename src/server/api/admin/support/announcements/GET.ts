import type { Request, Response } from 'express';
import { getAnnouncements } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { status, audience, page, limit } = req.query as Record<string, string>;
  res.json(getAnnouncements({ status, audience, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 20 }));
}
