import type { Request, Response } from 'express';
import { loadTemplates } from '../../../../lib/emailTemplateStore.js';

export default function handler(_req: Request, res: Response) {
  try {
    return res.json({ templates: loadTemplates() });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
