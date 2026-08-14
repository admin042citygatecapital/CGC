import type { Request, Response } from 'express';
import { upsertFeatureCard, deleteFeatureCard } from '../../../../lib/cmsExtStore.js';
export default async function handler(req: Request, res: Response) {
  const { action, id, ...data } = req.body ?? {};
  try {
    if (action === 'delete') {
      if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id required' });
      return res.json({ ok: await deleteFeatureCard(id, req.adminSession!.adminId) });
    }
    if (JSON.stringify(data).length > 50_000 || typeof data.title !== 'string' || data.title.length > 200 || typeof data.description !== 'string' || data.description.length > 5_000) return res.status(400).json({ error: 'Invalid feature card.' });
    res.json({ ok: true, feature: await upsertFeatureCard({ id, ...data }, req.adminSession!.adminId) });
  } catch (err) { console.error('cms.feature.save_failed', err); res.status(500).json({ error: 'Unable to update feature card.' }); }
}
