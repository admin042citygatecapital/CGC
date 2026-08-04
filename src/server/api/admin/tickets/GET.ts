import type { Request, Response } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CATEGORIES = [
  'Account Access', 'KYC Verification', 'Transfer Issue',
  'Card Problem', 'Crypto Support', 'General Inquiry',
  'Withdrawal Issue', 'Deposit Issue', 'Technical Support',
];

const TICKETS_FILE = join(process.cwd(), 'private', 'tickets', 'tickets.jsonl');

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  category: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

function loadTickets(): Ticket[] {
  if (!existsSync(TICKETS_FILE)) return [];
  try {
    return readFileSync(TICKETS_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as Ticket);
  } catch {
    return [];
  }
}

export default function handler(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const { status, priority, category, search } = q;
  const page  = Math.max(1, parseInt(q.page  ?? '1',  10));
  const limit = Math.min(100, parseInt(q.limit ?? '20', 10));

  let tickets = loadTickets();

  if (status)   tickets = tickets.filter(t => t.status   === status);
  if (priority) tickets = tickets.filter(t => t.priority === priority);
  if (category) tickets = tickets.filter(t => t.category === category);
  if (search) {
    const kw = search.toLowerCase();
    tickets = tickets.filter(t =>
      (t.subject   ?? '').toLowerCase().includes(kw) ||
      (t.userName  ?? '').toLowerCase().includes(kw) ||
      (t.userEmail ?? '').toLowerCase().includes(kw)
    );
  }

  tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = tickets.length;
  const paged = tickets.slice((page - 1) * limit, page * limit);

  return res.json({ tickets: paged, total, page, limit, categories: CATEGORIES });
}
