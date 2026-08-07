/**
 * POST /api/users/2fa/setup
 * Generates a TOTP secret for the customer to scan with an authenticator app.
 * Returns { secret, qrUrl } — the secret is shown once; the customer must verify it.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import crypto from 'node:crypto';

function base32Encode(buf: Buffer): string {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += CHARS[(value << (5 - bits)) & 31];
  return result;
}

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  // Generate a 20-byte random secret and encode as base32
  const secretBytes = crypto.randomBytes(20);
  const secret      = base32Encode(secretBytes);
  const issuer      = 'City Gate Capital';
  const label       = encodeURIComponent(`${issuer}:${user.email}`);
  const qrUrl       = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  return res.json({ secret, qrUrl });
}
