import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { purgeAllSessions } from '../../../lib/sessionStore.js';

const SECRET = 'cgc-wipe-xK9mP2qL7nR4';
const KYC_DIR = '/private/kyc';
const NL_DIR  = '/private/newsletter';
const FILES = [
  path.join(KYC_DIR, 'submissions.jsonl'),
  path.join(KYC_DIR, 'audit.jsonl'),
  path.join(KYC_DIR, 'expiry.jsonl'),
  path.join(NL_DIR,  'subscribers.jsonl'),
];

export async function POST(req: Request, res: Response) {
  if (req.body?.secret !== SECRET) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }
  const wiped: string[] = [];
  const errors: string[] = [];
  for (const f of FILES) {
    try {
      if (fs.existsSync(f)) { fs.writeFileSync(f, '', 'utf8'); }
      wiped.push(f);
    } catch (e: any) { errors.push(f + ': ' + e.message); }
  }
  purgeAllSessions();
  wiped.push('in-memory sessions');
  return res.json({ ok: true, wiped, errors });
}
