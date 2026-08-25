import type { Request, Response } from 'express';
import { getAllSubscribers, getSubscriberStats } from '../../../lib/subscriberStore.js';
import { authorizeAdminPermission } from '../../../lib/rbacMiddleware.js';

export default async function handler(req: Request, res: Response) {
  if (!(await authorizeAdminPermission(req, res, 'email.view'))) return;
  try {
    const page   = Math.max(1, Number(req.query.page ?? 1));
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const status = req.query.status as string | undefined;

    let all = await getAllSubscribers();
    if (status === 'active' || status === 'unsubscribed') {
      all = all.filter(s => s.status === status);
    }

    all.sort((a, b) => b.subscribedAt.localeCompare(a.subscribedAt));

    const total = all.length;
    const paginated = all.slice((page - 1) * limit, page * limit);
    const statsData = await getSubscriberStats();

    return res.json({
      subscribers: paginated,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: statsData,
    });
  } catch (err) {
    console.error('newsletter.subscribers.error', err);
    return res.status(500).json({ error: 'Failed to load subscribers' });
  }
}
