/**
 * GET /api/users/notifications/preferences
 * Returns notification preferences for the customer.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import fs from 'node:fs';
import path from 'node:path';

const PREFS_DIR  = '/private/notification-prefs';
const prefsFile  = (userId: string) => path.join(PREFS_DIR, `${userId}.json`);

export interface NotifPrefs {
  email:    boolean;
  push:     boolean;
  sms:      boolean;
  deposits: boolean;
  withdrawals: boolean;
  transfers:   boolean;
  security:    boolean;
  marketing:   boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  email: true, push: true, sms: false,
  deposits: true, withdrawals: true, transfers: true,
  security: true, marketing: false,
};

export function loadPrefs(userId: string): NotifPrefs {
  try {
    const f = prefsFile(userId);
    if (!fs.existsSync(f)) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(fs.readFileSync(f, 'utf8')) };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(userId: string, prefs: NotifPrefs) {
  if (!fs.existsSync(PREFS_DIR)) fs.mkdirSync(PREFS_DIR, { recursive: true });
  fs.writeFileSync(prefsFile(userId), JSON.stringify(prefs, null, 2));
}

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  return res.json({ preferences: loadPrefs(user.id) });
}
