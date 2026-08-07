import type { Request, Response } from 'express';
import { readConfig } from '../../../../lib/smartsuppStore.js';

export default function handler(_req: Request, res: Response) {
  res.json({ config: readConfig() });
}
