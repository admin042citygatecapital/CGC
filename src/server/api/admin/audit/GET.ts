import type { Request, Response } from 'express';
import { getAuditLog } from '../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const offset = (page - 1) * limit;

  const all  = await getAuditLog({ limit: 10000 });
  const total = all.length;
  const data  = all.slice(offset, offset + limit);

  return res.json({ data, total, page, limit });
}
