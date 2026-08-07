import type { Request, Response } from 'express';
import { writeConfig } from '../../../../lib/smartsuppStore.js';

export default function handler(req: Request, res: Response) {
  try {
    const config = writeConfig(req.body ?? {});
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
