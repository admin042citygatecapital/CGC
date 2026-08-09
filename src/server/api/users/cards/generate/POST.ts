/**
 * POST /api/users/cards/generate
 * Generates a new virtual card for the authenticated customer.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { createCard, getCardsForUser } from '../../../../lib/cardStore.js';
import { requireFinancialOperations } from '../../../../lib/platformMode.js';
import crypto from 'node:crypto';

const MAX_CARDS = 10;

function luhn(n: string): string {
  let s = 0, alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = parseInt(n[i], 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    s += d; alt = !alt;
  }
  return String((10 - (s % 10)) % 10);
}

function genCardNumber(): string {
  const prefix = '4'; // Visa
  const body   = Array.from({ length: 14 }, () => crypto.randomInt(0, 10)).join('');
  const partial = prefix + body;
  return partial + luhn(partial);
}

function genExpiry(): string {
  const now = new Date();
  const yr  = now.getFullYear() + 3;
  const mo  = String(now.getMonth() + 1).padStart(2, '0');
  return `${mo}/${String(yr).slice(-2)}`;
}

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  if (!requireFinancialOperations(res)) return;

  const existing = await getCardsForUser(user.id);
  if (existing.length >= MAX_CARDS) {
    return res.status(400).json({ error: `Maximum of ${MAX_CARDS} virtual cards allowed.` });
  }

  const number = genCardNumber();
  const cvv    = String(crypto.randomInt(100, 1000));

  const card = await createCard({
    userId:         user.id,
    cardholderName: user.name,
    number,
    expiry:         genExpiry(),
    cvv,
    network:        'visa',
    status:         'active',
    spendingLimit:  5000,
    color:          '#1a1a2e',
  });

  return res.status(201).json({
    card: {
      id:             card.id,
      cardholderName: card.cardholderName,
      numberMasked:   number.slice(0, 4) + ' **** **** ' + number.slice(-4),
      numberFull:     number.replace(/(.{4})/g, '$1 ').trim(),
      expiry:         card.expiry,
      cvv:            card.cvv,
      network:        card.network,
      status:         card.status,
      createdAt:      card.createdAt,
    },
  });
}
