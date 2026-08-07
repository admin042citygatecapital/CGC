import type { Request, Response } from 'express';
import { getComplaints } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { status, severity, category, search, page, limit } = req.query as Record<string, string>;
  res.json(getComplaints({ status, severity, category, search, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 20 }));
}
