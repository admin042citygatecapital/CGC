/**
 * PUT /api/admin/trading/providers
 * Body: { id: string, status?, priority?, rateLimit?, notes? }
 * Update a provider's admin-controlled config (status, fallback priority,
 * rate limit, notes). Health metrics (latency, error rate, uptime) are
 * read-only here — they're meant to be refreshed by a monitoring job, not
 * set by hand.
 */
import type { Request, Response } from 'express';
import { getProviders, upsertProvider, appendTradingLog, type ProviderStatus } from '../../../../lib/tradingAdminStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const STATUSES = ['active', 'degraded', 'offline', 'disabled'] as const satisfies readonly ProviderStatus[];

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id) {
    return res.status(400).json({ ok: false, error: 'id is required' });
  }

  const existing = getProviders().find(p => p.id === raw.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Provider not found' });

  const status = raw.status !== undefined ? isOneOf(raw.status, STATUSES) : existing.status;
  if (raw.status !== undefined && !status) {
    return res.status(400).json({ ok: false, error: 'Invalid status' });
  }

  const provider = {
    ...existing,
    status: status ?? existing.status,
    priority: typeof raw.priority === 'number' ? raw.priority : existing.priority,
    rateLimit: typeof raw.rateLimit === 'number' ? raw.rateLimit : existing.rateLimit,
    notes: typeof raw.notes === 'string' ? sanitizeString(raw.notes, 1000) : existing.notes,
    updatedAt: new Date().toISOString(),
  };
  upsertProvider(provider);

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';
  appendTradingLog({
    action: 'provider_updated', category: 'provider', targetId: provider.id, targetLabel: provider.name,
    details: `Updated provider ${provider.name}`,
    adminId, adminEmail, ip,
  });
  appendAudit({ event: 'trading_provider_updated', adminId, email: adminEmail, ip, meta: { id: provider.id, status: provider.status, priority: provider.priority } });

  return res.json({ ok: true, provider });
}
