import type { Request, Response } from 'express';
import { getOperationsStats, listOperationsItems, syncLegacyOperationsItems } from '../../../lib/operationsInboxStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    await syncLegacyOperationsItems();
    const result = await listOperationsItems({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25,
      status: String(req.query.status ?? ''),
      source: String(req.query.source ?? ''),
      priority: String(req.query.priority ?? ''),
      search: String(req.query.search ?? ''),
    });
    return res.json({ ...result, stats: await getOperationsStats() });
  } catch (error) {
    console.error('admin.operations.get.error', error);
    return res.status(500).json({ error: 'Failed to load operations inbox' });
  }
}
