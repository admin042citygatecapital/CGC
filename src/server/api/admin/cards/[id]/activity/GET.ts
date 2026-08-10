/**
 * GET /api/admin/cards/:id/activity
 * Returns the activity log for a specific card.
 */
import type { Request, Response } from 'express';
import { getCardActivity, findCardSummaryById } from '../../../../../lib/cardStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession;
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  const id = String(req.params.id ?? '');
  const card = await findCardSummaryById(id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
  const activity = (await getCardActivity(id)).slice(0, limit);

  return res.json({ data: activity, total: activity.length, dataClassification: 'synthetic_preview_card_activity' });
}
