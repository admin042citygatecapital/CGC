/** GET /api/admin/security/two-fa — read 2FA policy */
import type { Request, Response } from 'express';
import { read2FAPolicy } from '../../../../lib/securityStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    res.json({ policy: read2FAPolicy() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load 2FA policy', message: String(err) });
  }
}
