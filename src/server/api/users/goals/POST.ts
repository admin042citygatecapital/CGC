import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { getQueryClient } from '../../../db/db.js';

const STATUSES = new Set(['active', 'completed', 'paused']);
const CURRENCIES = new Set(['GBP', 'EUR', 'USD', 'CAD', 'AUD', 'CHF']);

function minor(value: unknown, field: string, allowZero = true): string {
  const amount = typeof value === 'string' ? value : String(value ?? '');
  if (!/^\d{1,15}$/.test(amount)) throw new Error(`${field} is invalid.`);
  const parsed = BigInt(amount);
  if ((!allowZero && parsed === 0n) || parsed > 100_000_000_000_000n) throw new Error(`${field} is invalid.`);
  return parsed.toString();
}

export default async function handler(req: Request, res: Response) {
  const customer = req.customerUser;
  if (!customer) return res.status(401).json({ error: 'Authentication required' });
  const action = String(req.body?.action ?? 'create');
  const sql = getQueryClient();
  try {
    if (action === 'delete') {
      const id = String(req.body?.id ?? '');
      if (!/^goal_[a-f0-9-]{36}$/.test(id)) return res.status(400).json({ error: 'Invalid goal.' });
      const deleted = await sql`DELETE FROM customer_goals WHERE id = ${id} AND user_id = ${customer.id} RETURNING id`;
      if (!deleted.length) return res.status(404).json({ error: 'Goal not found.' });
      return res.json({ ok: true });
    }

    const name = String(req.body?.name ?? '').trim().slice(0, 80);
    const currency = String(req.body?.currency ?? '').toUpperCase();
    const targetMinor = minor(req.body?.targetMinor, 'Target amount', false);
    const trackedMinor = minor(req.body?.trackedMinor ?? '0', 'Tracked progress');
    const monthlyMinor = minor(req.body?.monthlyContributionMinor ?? '0', 'Monthly contribution');
    const targetDate = req.body?.targetDate ? String(req.body.targetDate) : null;
    const status = String(req.body?.status ?? 'active');
    if (name.length < 2) return res.status(400).json({ error: 'Goal name must be at least 2 characters.' });
    if (!CURRENCIES.has(currency)) return res.status(400).json({ error: 'Unsupported goal currency.' });
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return res.status(400).json({ error: 'Invalid target date.' });
    if (!STATUSES.has(status)) return res.status(400).json({ error: 'Invalid goal status.' });

    if (action === 'update') {
      const id = String(req.body?.id ?? '');
      if (!/^goal_[a-f0-9-]{36}$/.test(id)) return res.status(400).json({ error: 'Invalid goal.' });
      const rows = await sql`
        UPDATE customer_goals SET name=${name}, currency=${currency}, target_minor=${targetMinor},
          tracked_minor=${trackedMinor}, monthly_contribution_minor=${monthlyMinor}, target_date=${targetDate},
          status=${status}, updated_at=NOW()
        WHERE id=${id} AND user_id=${customer.id} RETURNING id
      `;
      if (!rows.length) return res.status(404).json({ error: 'Goal not found.' });
      return res.json({ ok: true, id });
    }

    if (action !== 'create') return res.status(400).json({ error: 'Invalid goal action.' });
    const id = `goal_${crypto.randomUUID()}`;
    await sql`
      INSERT INTO customer_goals (id,user_id,name,currency,target_minor,tracked_minor,monthly_contribution_minor,target_date,status)
      VALUES (${id},${customer.id},${name},${currency},${targetMinor},${trackedMinor},${monthlyMinor},${targetDate},${status})
    `;
    return res.status(201).json({ ok: true, id });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith('is invalid.')) return res.status(400).json({ error: error.message });
    console.error('customer.goals.write.error', { customerId: customer.id, errorType: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(500).json({ error: 'Your goal could not be saved.' });
  }
}
