/**
 * GET /api/config/smartsupp-key
 * Public, unauthenticated — hands the Smartsupp widget key to the browser
 * so SmartsuppWidget.tsx can load the chat script. This is a client-side
 * site identifier, not a secret (Smartsupp's own loader snippet embeds it
 * directly in page HTML), so returning the real value here is intentional
 * and distinct from the masked admin-facing config endpoint.
 */
import type { Request, Response } from 'express';
import { readConfig } from '../../../lib/smartsuppStore.js';

export default async function handler(_req: Request, res: Response) {
  const config = readConfig();
  return res.json({ ok: true, key: config.apiKey || null, enabled: config.widgetEnabled });
}
