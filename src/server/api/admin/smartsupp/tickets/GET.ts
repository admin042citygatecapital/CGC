import type { Request, Response } from 'express';
import { getTickets } from '../../../../lib/smartsuppStore.js';

export default function handler(req: Request, res: Response) {
  const { status, priority, search, page, limit } = req.query as Record<string, string>;
  const result = getTickets({
    status,
    priority,
    search,
    page:  page  ? parseInt(page,  10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
  });
  res.json(result);
}
