import type { Request, Response } from 'express';

const CATEGORIES = ['Account Access','KYC Verification','Transfer Issue','Card Problem','Crypto Support','General Inquiry'];
const PRIORITIES = ['low','medium','high','urgent'];
const STATUSES   = ['open','in_progress','resolved','closed'];
const USERS = ['Alice Morgan','Bob Keller','Carol Thompson','David Rivera','Emma Santos','Frank Liu','Grace Walker','Henry Park'];

function seed(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `tkt_${String(i + 1).padStart(5, '0')}`,
    subject: [
      'Cannot access my account',
      'KYC documents rejected',
      'Transfer not received',
      'Card declined at POS',
      'Bitcoin withdrawal pending',
      'Change email address',
      'Account verification help',
      'Suspicious transaction',
    ][i % 8],
    user: USERS[i % USERS.length],
    userId: `usr_${String((i % 20) + 1).padStart(5, '0')}`,
    email: `${USERS[i % USERS.length].split(' ')[0].toLowerCase()}@example.com`,
    category: CATEGORIES[i % CATEGORIES.length],
    priority: PRIORITIES[i % PRIORITIES.length],
    status: STATUSES[i % STATUSES.length],
    messages: [
      { from: 'user', text: 'I need help with my account.', ts: new Date(Date.now() - i * 3600000 * 24).toISOString() },
    ],
    createdAt: new Date(Date.now() - i * 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - i * 1800000).toISOString(),
  }));
}

const TICKETS = seed(80);

export default function handler(req: Request, res: Response) {
  const page   = parseInt(String(req.query.page   ?? '1'));
  const limit  = parseInt(String(req.query.limit  ?? '20'));
  const status = String(req.query.status ?? '');
  const priority = String(req.query.priority ?? '');

  let filtered = TICKETS;
  if (status)   filtered = filtered.filter(t => t.status === status);
  if (priority) filtered = filtered.filter(t => t.priority === priority);

  const total = filtered.length;
  const data  = filtered.slice((page - 1) * limit, page * limit);

  return res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}
