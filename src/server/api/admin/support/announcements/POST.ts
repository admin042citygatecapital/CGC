import type { Request, Response } from 'express';
import { upsertAnnouncement, deleteAnnouncement } from '../../../../lib/supportExtStore.js';

export default function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'id required' });
      return res.json({ ok: deleteAnnouncement(id) });
    }
    const ann = upsertAnnouncement({ id, ...data });
    res.json({ ok: true, announcement: ann });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
