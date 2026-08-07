import type { Request, Response } from 'express';
import { saveLogoConfig } from '../../../../lib/cmsExtStore.js';
export default function handler(req: Request, res: Response) {
  try { res.json({ ok: true, logo: saveLogoConfig(req.body ?? {}) }); }
  catch (err) { res.status(500).json({ error: String(err) }); }
}
