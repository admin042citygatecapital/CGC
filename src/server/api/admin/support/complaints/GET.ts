import type { Request, Response } from 'express';
import { listComplaints } from '../../../../lib/complaintStore.js';

export default async function handler(req: Request, res: Response) {
  const { status, severity, category, search, page, limit } = req.query as Record<string, string>;
  try { res.json(await listComplaints({ status, severity, category, search, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 20 })); }
  catch (error) { const typed = error as Error & { status?: number; code?: string }; res.status(typed.status ?? 500).json({ error: typed.message, code: typed.code }); }
}
