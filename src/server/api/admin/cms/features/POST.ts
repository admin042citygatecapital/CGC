import type { Request, Response } from 'express';
import { upsertFeatureCard, deleteFeatureCard } from '../../../../lib/cmsExtStore.js';
export default function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'delete') { return res.json({ ok: deleteFeatureCard(id) }); }
    res.json({ ok: true, feature: upsertFeatureCard({ id, ...data }) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
}
