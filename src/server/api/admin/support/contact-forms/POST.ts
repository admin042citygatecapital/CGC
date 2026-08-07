import type { Request, Response } from 'express';
import { updateContactForm, createContactForm } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'update') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const sub = updateContactForm(id, data);
      if (!sub) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true, submission: sub });
    }
    const sub = createContactForm(data);
    res.status(201).json({ ok: true, submission: sub });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
