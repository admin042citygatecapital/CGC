/**
 * POST /api/admin/cards/reencrypt
 * SUPER_ADMIN only (see entry.ts — requireSuperAdmin).
 *
 * Re-encrypts every stored card's PAN/CVV under the current CARD_ENCRYPTION_KEY.
 * Run this manually right after rotating CARD_ENCRYPTION_KEY — it used to run
 * unconditionally on every server boot, which meant a full table re-encrypt
 * pass (and a real chance of failure against prod) on every restart even when
 * nothing had rotated. Trigger it on demand instead.
 */
import type { Request, Response } from 'express';
import { migrateCardsToEncrypted } from '../../../../lib/cardStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    const result = await migrateCardsToEncrypted();
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('admin.cards.reencrypt.error', err);
    return res.status(500).json({ ok: false, error: 'Card re-encryption failed' });
  }
}
