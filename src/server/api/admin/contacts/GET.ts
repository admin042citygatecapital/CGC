/** Contact submissions from the durable administration operations inbox. */
import type { Request, Response } from 'express';
import { listOperationsItems } from '../../../lib/operationsInboxStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '25'), 10) || 25));
    const search = String(req.query.search ?? '').trim().slice(0, 200);
    const result = await listOperationsItems({ page, limit, search, source: 'contact_form' });
    const data = result.data.map(item => ({
      id: item.referenceId,
      firstName: String(item.metadata.firstName ?? item.requesterName?.split(' ')[0] ?? ''),
      lastName: String(item.metadata.lastName ?? item.requesterName?.split(' ').slice(1).join(' ') ?? ''),
      email: item.requesterEmail ?? '',
      company: String(item.metadata.company ?? ''),
      subject: item.title,
      message: item.summary,
      ip: String(item.metadata.requestIp ?? 'not retained'),
      createdAt: item.createdAt,
    }));
    return res.json({ ...result, data });
  } catch (error) {
    console.error('admin.contacts.get.error', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ error: 'Unable to load contact submissions.' });
  }
}
