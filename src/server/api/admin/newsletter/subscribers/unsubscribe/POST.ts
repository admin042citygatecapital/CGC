/**
 * POST /api/admin/newsletter/subscribers/unsubscribe
 * Admin manually unsubscribes a user by email.
 */
import type { Request, Response } from 'express';
import { unsubscribe } from '../../../../../lib/subscriberStore.js';

export default function handler(req: Request, res: Response) {
  try {
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: 'email required' });
    const removed = unsubscribe(email.trim().toLowerCase());
    return res.json({ ok: true, removed });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
