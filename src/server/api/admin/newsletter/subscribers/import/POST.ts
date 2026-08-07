/**
 * POST /api/admin/newsletter/subscribers/import
 * Import subscribers from a CSV payload.
 * Body: { rows: Array<{ email: string; name?: string }> }
 */
import type { Request, Response } from 'express';
import { addSubscriber as upsert } from '../../../../../lib/subscriberStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { rows } = req.body as { rows: Array<{ email: string; name?: string }> };
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows array required' });

    let imported = 0, skipped = 0;
    for (const row of rows) {
      if (!row.email || !row.email.includes('@')) { skipped++; continue; }
      await upsert(row.email, row.name, 'admin_import');
      imported++;
    }
    return res.json({ ok: true, imported, skipped });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
