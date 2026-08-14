/**
 * GET /api/admin/support/canned
 * Returns all canned responses.
 */
import type { Request, Response } from 'express';
import { readCannedResponses } from '../../../../lib/supportDatabaseStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json(await readCannedResponses());
}
