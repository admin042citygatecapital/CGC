/**
 * POST /api/admin/support/canned
 * Create a new canned response.
 * Body: { title, body, category }
 */
import type { Request, Response } from 'express';
import { createCannedResponse } from '../../../../lib/supportDatabaseStore.js';

export default async function handler(req: Request, res: Response) {
  const { title, body, category } = req.body ?? {};
  if (!title?.trim()) return res.status(400).json({ ok: false, error: 'title required' });
  if (!body?.trim())  return res.status(400).json({ ok: false, error: 'body required' });

  if (String(title).trim().length > 120 || String(body).trim().length > 2_000 || String(category ?? '').trim().length > 80) {
    return res.status(400).json({ ok: false, error: 'Canned response fields exceed their permitted length' });
  }
  const item = await createCannedResponse({
    title:    String(title).trim(),
    body:     String(body).trim(),
    category: String(category ?? 'General').trim(),
  });
  return res.status(201).json({ ok: true, item });
}
