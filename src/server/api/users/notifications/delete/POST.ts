/**
 * POST /api/users/notifications/delete
 * Delete a single notification by id.
 * Body: { id: string }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import fs from 'node:fs';

const NOTIF_FILE = '/private/notifications/notifications.jsonl';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    if (!fs.existsSync(NOTIF_FILE)) return res.json({ ok: true });
    const lines = fs.readFileSync(NOTIF_FILE, 'utf8')
      .split('\n').filter(Boolean);
    const kept  = lines.filter(l => {
      try { const n = JSON.parse(l); return !(n.id === id && n.userId === user.id); }
      catch { return true; }
    });
    fs.writeFileSync(NOTIF_FILE, kept.join('\n') + (kept.length ? '\n' : ''));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
}
