import type { Request, Response } from 'express';
import { getAgents } from '../../../../lib/smartsuppStore.js';

export default function handler(_req: Request, res: Response) {
  res.json({ agents: getAgents() });
}
