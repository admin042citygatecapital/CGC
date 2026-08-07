import type { Request, Response } from 'express';
import { resetTemplate, type TemplateId } from '../../../../../lib/emailTemplateStore.js';

export default function handler(req: Request, res: Response) {
  try {
    const { id } = req.body as { id: TemplateId };
    if (!id) return res.status(400).json({ error: 'Template id required' });
    const template = resetTemplate(id);
    return res.json({ ok: true, template });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
