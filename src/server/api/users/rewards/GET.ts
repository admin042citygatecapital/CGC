import type { Request, Response } from 'express';
import { getQueryClient } from '../../../db/db.js';
import { isPlatformFeatureEnabled } from '../../../lib/platformFeatureControls.js';

export default async function handler(req: Request, res: Response) {
  const customer = req.customerUser;
  if (!customer) return res.status(401).json({ error: 'Authentication required' });
  const enabled = isPlatformFeatureEnabled('rewards');
  res.setHeader('Cache-Control', 'no-store');
  if (!enabled) return res.json({ enabled: false, account: null, activity: [], offers: [] });
  try {
    const sql = getQueryClient();
    const [accounts, activity] = await Promise.all([
      sql`SELECT points_balance, cashback_minor, cashback_currency, membership_tier, updated_at FROM customer_reward_accounts WHERE user_id=${customer.id} LIMIT 1`,
      sql`SELECT id,event_type,points,cashback_minor,currency,description,occurred_at FROM customer_reward_events WHERE user_id=${customer.id} ORDER BY occurred_at DESC LIMIT 50`,
    ]);
    const row = accounts[0];
    return res.json({
      enabled: true,
      account: row ? { pointsBalance: String(row.points_balance), cashbackMinor: String(row.cashback_minor), cashbackCurrency: row.cashback_currency, membershipTier: row.membership_tier, updatedAt: row.updated_at } : { pointsBalance: '0', cashbackMinor: '0', cashbackCurrency: 'GBP', membershipTier: 'Member', updatedAt: null },
      activity: activity.map(event => ({ id: event.id, eventType: event.event_type, points: String(event.points), cashbackMinor: String(event.cashback_minor), currency: event.currency, description: event.description, occurredAt: event.occurred_at })),
      offers: [],
      customerMutationAllowed: false,
    });
  } catch (error) {
    console.error('customer.rewards.read.error', { customerId: customer.id, errorType: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(500).json({ error: 'Your rewards could not be loaded.' });
  }
}
