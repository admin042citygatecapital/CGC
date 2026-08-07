import type { Request, Response } from 'express';
import { getProviders, upsertProvider, appendTradingLog } from '../../../../lib/tradingAdminStore.js';

export default async (req: Request, res: Response) => {
  try {
    const { id, ...updates } = req.body as { id: string; [k: string]: unknown };
    if (!id) return res.status(400).json({ error: 'Provider id required' });

    const all = getProviders();
    const idx = all.findIndex(p => p.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Provider not found' });

    const updated = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
    upsertProvider(updated);

    const session = req.adminSession;
    appendTradingLog({
      action: 'update_provider',
      category: 'provider',
      targetId: id,
      targetLabel: updated.name,
      details: `Updated provider ${updated.name}: ${JSON.stringify(updates)}`,
      adminId: session?.email ?? 'admin',
      adminEmail: session?.email ?? 'admin',
      ip: req.ip,
    });

    res.json({ provider: updated });
  } catch (err) {
    console.error('[admin/trading/providers PUT]', err);
    res.status(500).json({ error: 'Failed to update provider' });
  }
};
