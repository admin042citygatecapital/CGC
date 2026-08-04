/**
 * GET /api/admin/security/ip-lists
 * IP blacklist/whitelist, country blocks, and VPN-detection mode.
 */
import type { Request, Response } from 'express';
import { readIpLists } from '../../../../lib/securityStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, lists: readIpLists() });
  } catch (err) {
    console.error('[admin/security/ip-lists GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load IP lists' });
  }
}
