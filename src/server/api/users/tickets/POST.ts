import type { Request, Response } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { appendAudit } from '../../../lib/auditLog.js';

const TICKETS_DIR  = join(process.cwd(), 'private', 'tickets');
const TICKETS_FILE = join(TICKETS_DIR, 'tickets.jsonl');

const VALID_CATEGORIES = [
  'Account Access', 'KYC Verification', 'Transfer Issue',
  'Card Problem', 'Crypto Support', 'General Inquiry',
  'Withdrawal Issue', 'Deposit Issue', 'Technical Support',
];

const VALID_PRIORITIES = ['low', 'medium', 'high'];

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Unauthorised' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const body = req.body as Record<string, unknown>;
  const subject  = String(body.subject  ?? '').trim().substring(0, 200);
  const message  = String(body.message  ?? '').trim().substring(0, 5000);
  const category = String(body.category ?? 'General Inquiry').trim();
  const priority = String(body.priority ?? 'medium').trim();

  if (!subject)  return res.status(400).json({ error: 'subject is required' });
  if (!message)  return res.status(400).json({ error: 'message is required' });
  if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });
  if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

  const now = new Date().toISOString();
  const ticket = {
    id:        randomUUID(),
    subject,
    message,
    category,
    priority,
    status:    'open' as const,
    userId:    user.id,
    userName:  user.name,
    userEmail: user.email,
    createdAt: now,
    updatedAt: now,
  };

  if (!existsSync(TICKETS_DIR)) mkdirSync(TICKETS_DIR, { recursive: true });

  const line = JSON.stringify(ticket);
  if (existsSync(TICKETS_FILE)) {
    const existing = readFileSync(TICKETS_FILE, 'utf8');
    writeFileSync(TICKETS_FILE, existing.trimEnd() + '\n' + line + '\n', 'utf8');
  } else {
    writeFileSync(TICKETS_FILE, line + '\n', 'utf8');
  }

  try { appendAudit({ event: 'ticket_created', userId: user.id, email: user.email, meta: { ticketId: ticket.id, subject } }); } catch { /* non-critical: audit/log-event failures must not block the response */ }

  return res.status(201).json({ ok: true, ticketId: ticket.id });
}
