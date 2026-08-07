import type { Request, Response } from 'express';
import { updateComplaint, createComplaint } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'update') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const c = updateComplaint(id, data);
      if (!c) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true, complaint: c });
    }
    const c = createComplaint(data);
    res.status(201).json({ ok: true, complaint: c });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
