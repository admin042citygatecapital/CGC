/**
 * GET /api/admin/cards
 * List all virtual cards across all users. Supports filters: userId, status, search, page, limit.
 */
import type { Request, Response } from 'express';
import { getAllCards } from '../../../lib/cardStore.js';
import { findUserById } from '../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession;
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  const { userId, status, search, page, limit } = req.query as Record<string, string>;

  const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
  const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 25;
  const query = search?.toLowerCase();
  const allCards = (await getAllCards()).filter(card =>
    (!userId || card.userId === userId) &&
    (!status || card.status === status) &&
    (!query || card.cardholderName.toLowerCase().includes(query) || card.number.slice(-4).includes(query))
  );
  const pageCards = allCards.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  const data = await Promise.all(pageCards.map(async c => {
    const user = await findUserById(c.userId);
    return {
      id:             c.id,
      userId:         c.userId,
      userName:       user?.name  ?? 'Unknown',
      userEmail:      user?.email ?? '',
      cardholderName: c.cardholderName,
      numberMasked:   c.number.slice(0, 4) + ' **** **** ' + c.number.slice(-4),
      expiry:         c.expiry,
      network:        c.network,
      status:         c.status,
      spendingLimit:  c.spendingLimit ?? null,
      hasPin:         !!c.pinHash,
      issuedByAdmin:  c.issuedByAdmin ?? false,
      replacedById:   c.replacedById  ?? null,
      createdAt:      c.createdAt,
      updatedAt:      c.updatedAt,
    };
  }));

  return res.json({
    data,
    total: allCards.length,
    page:  pageNum,
    pages: Math.max(1, Math.ceil(allCards.length / limitNum)),
  });
}
