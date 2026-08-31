import type { Request, Response } from 'express';
import { getQueryClient, isDatabaseConfigured } from '../../../db/db.js';

export default async function handler(req: Request, res: Response) {
  const customer = req.customerUser;
  if (!customer) return res.status(401).json({ error: 'Authentication required' });
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Savings goals are temporarily unavailable.', code: 'GOAL_STORAGE_UNAVAILABLE' });
  }
  try {
    const sql = getQueryClient();
    const goals = await sql`
      SELECT id, name, currency, target_minor, tracked_minor,
             monthly_contribution_minor, target_date, status, created_at, updated_at
      FROM customer_goals
      WHERE user_id = ${customer.id}
      ORDER BY updated_at DESC
    `;
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      goals: goals.map(goal => ({
        id: goal.id,
        name: goal.name,
        currency: goal.currency,
        targetMinor: String(goal.target_minor),
        trackedMinor: String(goal.tracked_minor),
        monthlyContributionMinor: String(goal.monthly_contribution_minor),
        targetDate: goal.target_date,
        status: goal.status,
        createdAt: goal.created_at,
        updatedAt: goal.updated_at,
      })),
      planningOnly: true,
    });
  } catch (error) {
    console.error('customer.goals.read.error', { customerId: customer.id, errorType: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ error: 'Your goals could not be loaded.', code: 'GOAL_STORAGE_UNAVAILABLE' });
  }
}
