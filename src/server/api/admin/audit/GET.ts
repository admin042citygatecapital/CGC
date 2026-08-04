import type { Request, Response } from 'express';
import { readAudit } from '../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const { data, total } = await readAudit(limit, (page - 1) * limit);

  return res.json({ ok: true, data, total, page, limit });
}
