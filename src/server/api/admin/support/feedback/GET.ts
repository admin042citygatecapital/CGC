import type { Request, Response } from 'express';
import { getFeedback } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { type, status, search, page, limit } = req.query as Record<string, string>;
  res.json(getFeedback({ type, status, search, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 20 }));
}
