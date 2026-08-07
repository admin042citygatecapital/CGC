import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { upsertFee, deleteFee, appendTradingLog, type FeeTier } from '../../../../lib/tradingAdminStore.js';

export default async (req: Request, res: Response) => {
  try {
    const { action, fee } = req.body as { action: 'upsert' | 'delete'; fee?: Partial<FeeTier> & { id?: string } };
    const session = req.adminSession;
    const adminId    = session?.email ?? 'admin';
    const adminEmail = session?.email ?? 'admin';

    if (action === 'delete') {
      if (!fee?.id) return res.status(400).json({ error: 'fee.id required for delete' });
      const ok = deleteFee(fee.id);
      if (!ok) return res.status(404).json({ error: 'Fee tier not found' });
      appendTradingLog({ action: 'delete_fee', category: 'fee', targetId: fee.id, targetLabel: fee.name, details: `Deleted fee tier: ${fee.name}`, adminId, adminEmail, ip: req.ip });
      return res.json({ ok: true });
    }

    if (!fee) return res.status(400).json({ error: 'fee object required' });
    const now = new Date().toISOString();
    const full: FeeTier = {
      id:           fee.id ?? randomUUID(),
      name:         fee.name ?? 'Custom',
      assetClass:   fee.assetClass ?? 'all',
      makerFeeRate: fee.makerFeeRate ?? 0.001,
      takerFeeRate: fee.takerFeeRate ?? 0.002,
      minVolume30d: fee.minVolume30d ?? 0,
      maxVolume30d: fee.maxVolume30d ?? null,
      isDefault:    fee.isDefault ?? false,
      updatedAt:    now,
      createdAt:    fee.createdAt ?? now,
    };
    upsertFee(full);
    appendTradingLog({ action: 'upsert_fee', category: 'fee', targetId: full.id, targetLabel: full.name, details: `Saved fee tier: ${full.name}`, adminId, adminEmail, ip: req.ip });
    res.json({ fee: full });
  } catch (err) {
    console.error('[admin/trading/fees POST]', err);
    res.status(500).json({ error: 'Failed to save fee tier' });
  }
};
