import type { Request, Response } from 'express';
import { getQueryClient, isDatabaseConfigured } from '../../../db/db.js';

export default async function handler(req: Request, res: Response) {
  const customer = req.customerUser;
  if (!customer) return res.status(401).json({ error: 'Authentication required' });
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Bill schedules are temporarily unavailable.', code: 'BILL_STORAGE_UNAVAILABLE' });
  }
  try {
    const sql = getQueryClient();
    const bills = await sql`
      SELECT id, payee, category, currency, amount_minor, frequency,
             next_due_date, reminder_days, status, created_at, updated_at
      FROM customer_bill_schedules
      WHERE user_id = ${customer.id}
      ORDER BY next_due_date, updated_at DESC
    `;
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      bills: bills.map(bill => ({ ...bill, amount_minor: String(bill.amount_minor) })),
      executionEnabled: false,
      planningOnly: true,
    });
  } catch (error) {
    console.error('customer.bills.read.error', { customerId: customer.id, errorType: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ error: 'Your bill schedule could not be loaded.', code: 'BILL_STORAGE_UNAVAILABLE' });
  }
}
