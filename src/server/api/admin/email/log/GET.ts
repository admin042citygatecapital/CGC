import type { Request, Response } from 'express';
import { readEmailLog, type DeliveryStatus } from '../../../../lib/campaignStore.js';

export default function handler(req: Request, res: Response) {
  try {
    const { status, template, dateFrom, dateTo, limit } = req.query as Record<string, string>;
    const entries = readEmailLog({
      status:   status   as DeliveryStatus | undefined,
      template: template || undefined,
      dateFrom: dateFrom || undefined,
      dateTo:   dateTo   || undefined,
      limit:    limit    ? Math.min(500, Number(limit)) : 200,
    });
    return res.json({ entries, total: entries.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
