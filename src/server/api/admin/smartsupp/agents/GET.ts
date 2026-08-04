/**
 * GET /api/admin/smartsupp/agents
 */
import type { Request, Response } from 'express';
import { getAgents } from '../../../../lib/smartsuppStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json({ ok: true, agents: getAgents() });
}
