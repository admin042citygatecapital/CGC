import type { Request, Response } from 'express';
import { updateFeedback, createFeedback } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'update') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const entry = updateFeedback(id, data);
      if (!entry) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true, entry });
    }
    const entry = createFeedback(data);
    res.status(201).json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
