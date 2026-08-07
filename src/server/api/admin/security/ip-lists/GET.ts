/** GET /api/admin/security/ip-lists — return blacklist, whitelist, country blocks */
import type { Request, Response } from 'express';
import { readIpLists } from '../../../../lib/securityStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    res.json(readIpLists());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load IP lists', message: String(err) });
  }
}
