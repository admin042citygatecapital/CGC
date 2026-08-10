import type { Request, Response } from 'express';
import {
  getLoginHistory,
  type LoginActor,
  type LoginEvent,
  type LoginResult,
} from '../../../../lib/loginLog.js';

const ACTORS = new Set<LoginActor>(['admin', 'user']);
const RESULTS = new Set<LoginResult>([
  'success', 'failed', 'blocked', 'totp_failed', 'otp_sent', 'otp_failed',
  'account_locked', 'status_denied',
]);

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function matchesSearch(event: LoginEvent, search: string): boolean {
  const haystack = [
    event.email, event.ip, event.browser, event.device, event.os,
    event.country, event.reason ?? '',
  ].join(' ').toLowerCase();
  return haystack.includes(search);
}

export default async function handler(req: Request, res: Response) {
  try {
    const type = String(req.query.type ?? 'login');
    if (type !== 'login') return res.status(400).json({ error: 'Unsupported security log type' });

    const actorValue = req.query.actor ? String(req.query.actor) : undefined;
    if (actorValue && !ACTORS.has(actorValue as LoginActor)) {
      return res.status(400).json({ error: 'Invalid actor filter' });
    }

    const resultValue = req.query.result ? String(req.query.result) : undefined;
    if (resultValue && !RESULTS.has(resultValue as LoginResult)) {
      return res.status(400).json({ error: 'Invalid result filter' });
    }

    const limit = boundedInteger(req.query.limit, 50, 1, 200);
    const offset = boundedInteger(req.query.offset, 0, 0, 10_000);
    const search = String(req.query.search ?? '').trim().toLowerCase();

    let events = await getLoginHistory({
      actor: actorValue as LoginActor | undefined,
      limit: 10_000,
    });
    if (resultValue) events = events.filter(event => event.result === resultValue);
    if (search) events = events.filter(event => matchesSearch(event, search));

    return res.json({
      data: events.slice(offset, offset + limit),
      total: events.length,
      limit,
      offset,
      dataClassification: 'persisted_login_events',
    });
  } catch (error) {
    console.error('[admin/security/logs GET]', error);
    return res.status(500).json({ error: 'Failed to load security logs' });
  }
}
