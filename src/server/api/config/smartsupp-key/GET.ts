/**
 * GET /api/config/smartsupp-key
 *
 * Returns the Smartsupp widget key for client-side use.
 * The key is a PUBLIC widget identifier (like a GA tracking ID) — safe to
 * expose via this endpoint. It is sourced exclusively from the
 * SMARTSUPP_KEY secret. There is no hardcoded fallback: if the secret is
 * not configured, this endpoint returns 404 so the caller can skip
 * loading the chat widget rather than silently using a baked-in value.
 */
import type { Request, Response } from 'express';
import { getSecret } from '#airo/secrets';

export default function handler(_req: Request, res: Response) {
  const key = getSecret('SMARTSUPP_KEY');
  if (!key) {
    return res.status(404).json({ success: false, error: 'Smartsupp is not configured' });
  }
  // Cache for 1 hour — the key rarely changes
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ key: String(key) });
}
