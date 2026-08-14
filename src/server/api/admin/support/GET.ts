/**
 * GET /api/admin/support
 * Admin lists support conversations with full filter/sort/pagination.
 * Query: status, priority, category, assignedTo, search, dateRange, dateFrom, dateTo, sort, page, limit
 */
import type { Request, Response } from 'express';
import { queryConversations } from '../../../lib/supportDatabaseStore.js';
import type { SortOption } from '../../../lib/supportDatabaseStore.js';

export default async function handler(req: Request, res: Response) {
  const q = req.query as Record<string, string>;

  const result = await queryConversations({
    status:     q.status     || undefined,
    priority:   q.priority   || undefined,
    category:   q.category   || undefined,
    assignedTo: q.assignedTo || undefined,
    search:     q.search     || undefined,
    dateRange:  (q.dateRange as 'today' | '7d' | '30d' | 'custom') || undefined,
    dateFrom:   q.dateFrom   || undefined,
    dateTo:     q.dateTo     || undefined,
    sort:       (q.sort as SortOption) || 'newest',
    page:       parseInt(q.page  ?? '1',  10) || 1,
    limit:      Math.min(50, parseInt(q.limit ?? '20', 10) || 20),
  });

  return res.json(result);
}
