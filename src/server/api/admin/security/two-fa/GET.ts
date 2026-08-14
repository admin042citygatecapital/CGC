/** GET /api/admin/security/two-fa — read 2FA policy */
import type { Request, Response } from 'express';
import { readTwoFactorPolicy } from '../../../../lib/securityConfigStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    res.json({ policy: await readTwoFactorPolicy() });
  } catch {
    res.status(503).json({ error: 'Security configuration is temporarily unavailable' });
  }
}
