/**
 * GET /api/admin/support/messages
 * Direct-message inbox. Query: search, read, starred, archived, page, limit
 */
import type { Request, Response } from 'express';
import { getMessages } from '../../../../lib/supportExtStore.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

function parseBool(v: string | undefined): boolean | undefined {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

export default async function handler(req: Request, res: Response) {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = getMessages({
      search: q.search ? sanitizeString(q.search) : undefined,
      read: parseBool(q.read),
      starred: parseBool(q.starred),
      archived: parseBool(q.archived),
      page: q.page ? Math.max(1, parseInt(q.page, 10) || 1) : undefined,
      limit: q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)) : undefined,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[admin/support/messages GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load messages' });
  }
}
