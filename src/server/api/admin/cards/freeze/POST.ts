/**
 * POST /api/admin/cards/freeze
 * Admin freeze or unfreeze any card.
 * Body: { cardId }
 */
import type { Request, Response } from 'express';
import { findCardById, updateCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession;
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  const { cardId } = req.body as { cardId?: string };
  if (!cardId) return res.status(400).json({ error: 'cardId is required' });

  const card = await findCardById(cardId);
  if (!card || card.status === 'deleted' || card.status === 'replaced') {
    return res.status(404).json({ error: 'Card not found or cannot be modified' });
  }

  const newStatus = card.status === 'frozen' ? 'active' : 'frozen';
  const updated   = await updateCard(cardId, { status: newStatus });
  if (!updated) return res.status(500).json({ error: 'Failed to update card' });

  const action = newStatus === 'frozen' ? 'admin_frozen' : 'admin_unfrozen';
  appendCardActivity({ cardId, userId: card.userId, event: action, meta: { adminId: session.adminId }, ts: new Date().toISOString() }).catch(() => {});
  appendAudit({ event: `admin_card_${newStatus}`, adminId: session.adminId, userId: card.userId, ip: req.ip, meta: { cardId } });

  return res.json({
    message: `Card ${newStatus === 'frozen' ? 'frozen' : 'unfrozen'} successfully`,
    cardId,
    status: newStatus,
  });
}
