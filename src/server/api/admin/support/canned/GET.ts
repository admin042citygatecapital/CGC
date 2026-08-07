/**
 * GET /api/admin/support/canned
 * Returns all canned responses.
 */
import type { Request, Response } from 'express';
import { readCannedResponses } from '../../../../lib/supportStore.js';

export default function handler(_req: Request, res: Response) {
  return res.json(readCannedResponses());
}
