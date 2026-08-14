import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { getQueryClient } from '../../../db/db.js';

const FREQUENCIES = new Set(['one_time', 'weekly', 'monthly', 'quarterly', 'annually']);
const STATUSES = new Set(['scheduled', 'paused', 'completed']);
const CURRENCIES = new Set(['GBP', 'EUR', 'USD', 'CAD', 'AUD', 'CHF']);

function amountMinor(value: unknown): string | null {
  const raw = String(value ?? '');
  if (!/^\d{1,15}$/.test(raw)) return null;
  const amount = BigInt(raw);
  return amount > 0n && amount <= 100_000_000_000_000n ? amount.toString() : null;
}

export default async function handler(req: Request, res: Response) {
  const customer = req.customerUser;
  if (!customer) return res.status(401).json({ error: 'Authentication required' });
  const action = String(req.body?.action ?? 'create');
  const sql = getQueryClient();
  try {
    if (action === 'delete') {
      const id = String(req.body?.id ?? '');
      if (!/^bill_[a-f0-9-]{36}$/.test(id)) return res.status(400).json({ error: 'Invalid bill schedule.' });
      const removed = await sql`DELETE FROM customer_bill_schedules WHERE id=${id} AND user_id=${customer.id} RETURNING id`;
      return removed.length ? res.json({ ok: true }) : res.status(404).json({ error: 'Bill schedule not found.' });
    }

    const payee = String(req.body?.payee ?? '').trim().slice(0, 100);
    const category = String(req.body?.category ?? '').trim().slice(0, 50);
    const currency = String(req.body?.currency ?? '').toUpperCase();
    const amount = amountMinor(req.body?.amountMinor);
    const frequency = String(req.body?.frequency ?? 'monthly');
    const nextDueDate = String(req.body?.nextDueDate ?? '');
    const reminderDays = Number(req.body?.reminderDays ?? 3);
    const status = String(req.body?.status ?? 'scheduled');
    if (payee.length < 2 || category.length < 2) return res.status(400).json({ error: 'Payee and category are required.' });
    if (!amount) return res.status(400).json({ error: 'Amount is invalid.' });
    if (!CURRENCIES.has(currency) || !FREQUENCIES.has(frequency) || !STATUSES.has(status)) return res.status(400).json({ error: 'Bill configuration is invalid.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) return res.status(400).json({ error: 'Next due date is invalid.' });
    if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 30) return res.status(400).json({ error: 'Reminder days must be between 0 and 30.' });

    if (action === 'update') {
      const id = String(req.body?.id ?? '');
      if (!/^bill_[a-f0-9-]{36}$/.test(id)) return res.status(400).json({ error: 'Invalid bill schedule.' });
      const rows = await sql`
        UPDATE customer_bill_schedules SET payee=${payee},category=${category},currency=${currency},amount_minor=${amount},
          frequency=${frequency},next_due_date=${nextDueDate},reminder_days=${reminderDays},status=${status},updated_at=NOW()
        WHERE id=${id} AND user_id=${customer.id} RETURNING id
      `;
      return rows.length ? res.json({ ok: true, id }) : res.status(404).json({ error: 'Bill schedule not found.' });
    }
    if (action !== 'create') return res.status(400).json({ error: 'Invalid bill action.' });
    const id = `bill_${crypto.randomUUID()}`;
    await sql`
      INSERT INTO customer_bill_schedules (id,user_id,payee,category,currency,amount_minor,frequency,next_due_date,reminder_days,status)
      VALUES (${id},${customer.id},${payee},${category},${currency},${amount},${frequency},${nextDueDate},${reminderDays},${status})
    `;
    return res.status(201).json({ ok: true, id });
  } catch (error) {
    console.error('customer.bills.write.error', { customerId: customer.id, errorType: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(500).json({ error: 'Your bill schedule could not be saved.' });
  }
}
