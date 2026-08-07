import type { Request, Response } from 'express';
import { getMessages } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { search, read, starred, archived, page, limit } = req.query as Record<string, string>;
  const result = getMessages({
    search,
    read:     read     !== undefined ? read     === 'true' : undefined,
    starred:  starred  !== undefined ? starred  === 'true' : undefined,
    archived: archived !== undefined ? archived === 'true' : undefined,
    page:  page  ? parseInt(page,  10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
  });
  res.json(result);
}
