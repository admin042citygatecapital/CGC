/** GET /api/admin/security/ip-lists — return blacklist, whitelist, country blocks */
import type { Request, Response } from 'express';
import { readSecurityIpLists } from '../../../../lib/securityConfigStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    res.json(await readSecurityIpLists());
  } catch {
    res.status(503).json({ error: 'Security configuration is temporarily unavailable' });
  }
}
