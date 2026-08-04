/**
 * GET /api/admin/support
 * List/query support conversations with filters, sorting, and pagination.
 * Query: status, priority, category, assignedTo, search, dateRange
 *        (today|7d|30d|custom), dateFrom, dateTo, sort (newest|oldest|
 *        priority|longest), page, limit
 */
import type { Request, Response } from 'express';
import { queryConversations, type SortOption } from '../../../lib/supportStore.js';
import { sanitizeString, isOneOf } from '../../../lib/inputValidator.js';

const SORT_OPTIONS = ['newest', 'oldest', 'priority', 'longest'] as const;
const DATE_RANGES = ['today', '7d', '30d', 'custom'] as const;

export default async function handler(req: Request, res: Response) {
  try {
    const q = req.query as Record<string, string | undefined>;

    const result = queryConversations({
      status:     q.status ? sanitizeString(q.status) : undefined,
      priority:   q.priority ? sanitizeString(q.priority) : undefined,
      category:   q.category ? sanitizeString(q.category) : undefined,
      assignedTo: q.assignedTo ? sanitizeString(q.assignedTo) : undefined,
      search:     q.search ? sanitizeString(q.search) : undefined,
      dateRange:  isOneOf(q.dateRange, DATE_RANGES) ?? undefined,
      dateFrom:   q.dateFrom ? sanitizeString(q.dateFrom) : undefined,
      dateTo:     q.dateTo ? sanitizeString(q.dateTo) : undefined,
      sort:       (isOneOf(q.sort, SORT_OPTIONS) ?? undefined) as SortOption | undefined,
      page:       q.page ? Math.max(1, parseInt(q.page, 10) || 1) : undefined,
      limit:      q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)) : undefined,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[admin/support] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load conversations' });
  }
}
