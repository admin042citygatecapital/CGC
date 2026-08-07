import type { Request, Response } from 'express';
import { getContactForms } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { status, search, page, limit } = req.query as Record<string, string>;
  res.json(getContactForms({ status, search, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 20 }));
}
