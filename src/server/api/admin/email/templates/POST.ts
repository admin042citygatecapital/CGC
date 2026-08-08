import type { Request, Response } from 'express';
import { saveTemplate, type TemplateId } from '../../../../lib/emailTemplateStore.js';
import { saveEmailBranding, type EmailBrandingConfig } from '../../../../lib/emailBrandingStore.js';

export default function handler(req: Request, res: Response) {
  try {
    const { id, subject, body, kind, branding } = req.body as {
      id?: TemplateId;
      subject?: string;
      body?: string;
      kind?: 'branding';
      branding?: Partial<EmailBrandingConfig>;
    };
    if (kind === 'branding') {
      if (!branding) return res.status(400).json({ error: 'Branding configuration is required.' });
      return res.json({ ok: true, branding: saveEmailBranding(branding, 'admin') });
    }
    if (!id) return res.status(400).json({ error: 'Template id required' });
    const updated = saveTemplate(id, { subject, body }, 'admin');
    return res.json({ ok: true, template: updated });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
