/**
 * GET /api/admin/smartsupp/config
 */
import type { Request, Response } from 'express';
import { readConfig } from '../../../../lib/smartsuppStore.js';

export default async function handler(_req: Request, res: Response) {
  const { apiKey, ...rest } = readConfig();
  return res.json({ ok: true, config: { ...rest, apiKeySet: Boolean(apiKey) } });
}
