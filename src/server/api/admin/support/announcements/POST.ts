/**
 * POST /api/admin/support/announcements
 * Body: { id?: string, title, body, type, audience, channels, status,
 *         scheduledAt?, expiresAt? }
 * Create a new announcement, or update an existing one when `id` is given.
 */
import type { Request, Response } from 'express';
import { upsertAnnouncement } from '../../../../lib/supportExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const TYPES = ['info', 'warning', 'success', 'maintenance', 'promotion'] as const;
const AUDIENCES = ['all', 'verified', 'premium', 'admins'] as const;
const STATUSES = ['draft', 'scheduled', 'active', 'expired'] as const;
const CHANNELS = ['banner', 'email', 'push', 'dashboard'] as const;

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;

  const title = sanitizeString(raw.title, 200);
  const body = sanitizeString(raw.body, 5000);
  if (!title || !body) {
    return res.status(400).json({ ok: false, error: 'title and body are required' });
  }

  const channels = Array.isArray(raw.channels)
    ? raw.channels.filter((c): c is typeof CHANNELS[number] => isOneOf(c, CHANNELS) !== null)
    : undefined;

  const announcement = upsertAnnouncement({
    id: typeof raw.id === 'string' ? raw.id : undefined,
    title,
    body,
    type: isOneOf(raw.type, TYPES) ?? undefined,
    audience: isOneOf(raw.audience, AUDIENCES) ?? undefined,
    channels: channels && channels.length > 0 ? channels : undefined,
    status: isOneOf(raw.status, STATUSES) ?? undefined,
    scheduledAt: typeof raw.scheduledAt === 'string' ? raw.scheduledAt : null,
    expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : null,
    createdBy: req.adminSession?.email,
  });

  appendAudit({
    event: 'support_announcement_saved',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { id: announcement.id },
  });

  return res.status(201).json({ ok: true, announcement });
}
