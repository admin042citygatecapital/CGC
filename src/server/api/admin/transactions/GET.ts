import type { Request, Response } from 'express';

const TYPES    = ['deposit','withdrawal','transfer','crypto_buy','crypto_sell','fee','refund'];
const STATUSES = ['completed','pending','failed','flagged'];
const CURRENCIES = ['USD','EUR','GBP','BTC','ETH','USDT','CHF','JPY'];
const USERS = ['Alice Morgan','Bob Keller','Carol Thompson','David Rivera','Emma Santos','Frank Liu','Grace Walker','Henry Park'];

function seed(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `tx_${String(i + 1).padStart(7, '0')}`,
    type: TYPES[i % TYPES.length],
    user: USERS[i % USERS.length],
    userId: `usr_${String((i % 20) + 1).padStart(5, '0')}`,
    amount: parseFloat((Math.random() * 50000 + 10).toFixed(2)),
    currency: CURRENCIES[i % CURRENCIES.length],
    status: STATUSES[i % STATUSES.length],
    reference: `REF${String(i + 100000).padStart(8, '0')}`,
    description: ['Bank transfer','Crypto purchase','Withdrawal request','Fee charge','Refund'][i % 5],
    createdAt: new Date(Date.now() - i * 1800000).toISOString(),
    flagged: i % 23 === 0,
  }));
}

const TXS = seed(500);

export default function handler(req: Request, res: Response) {
  const page   = parseInt(String(req.query.page  ?? '1'));
  const limit  = parseInt(String(req.query.limit ?? '25'));
  const type   = String(req.query.type   ?? '');
  const status = String(req.query.status ?? '');
  const search = String(req.query.search ?? '').toLowerCase();

  let filtered = TXS;
  if (type)   filtered = filtered.filter(t => t.type === type);
  if (status) filtered = filtered.filter(t => t.status === status);
  if (search) filtered = filtered.filter(t => t.user.toLowerCase().includes(search) || t.id.includes(search) || t.reference.toLowerCase().includes(search));

  const total = filtered.length;
  const data  = filtered.slice((page - 1) * limit, page * limit);

  return res.json({ ok: true, data, total, page, limit, pages: Math.ceil(total / limit) });
}
