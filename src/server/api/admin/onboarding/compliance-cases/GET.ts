import type { Request, Response } from 'express';
import { listComplianceCases } from '../../../../lib/complianceCaseStore.js';
export default async function handler(req: Request, res: Response) {
  return res.json({ data: await listComplianceCases(req.query.userId ? String(req.query.userId) : undefined) });
}
