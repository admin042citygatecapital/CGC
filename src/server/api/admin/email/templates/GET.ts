import type { Request, Response } from 'express';
import { loadTemplates } from '../../../../lib/emailTemplateStore.js';
import { loadEmailBranding } from '../../../../lib/emailBrandingStore.js';

export default function handler(_req: Request, res: Response) {
  try {
    return res.json({ templates: loadTemplates(), branding: loadEmailBranding() });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
