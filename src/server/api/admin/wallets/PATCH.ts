/**
 * PATCH /api/admin/wallets
 * Update a crypto wallet deposit address.
 * Body: { id, address, enabled?, minDeposit? }
 */
import type { Request, Response } from 'express';
import { updateWallet } from '../../../lib/walletStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { requireFinancialOperations } from '../../../lib/platformMode.js';

export default async function handler(req: Request, res: Response) {
  if (!requireFinancialOperations(res)) return;
  const session = req.adminSession!;
  const { id, address, enabled, minDeposit } = req.body ?? {};

  if (!id) return res.status(400).json({ success: false, error: 'id is required' });

  const patch: Record<string, unknown> = { updatedBy: session.adminId };
  if (address     !== undefined) patch.address     = String(address).trim();
  if (enabled     !== undefined) patch.enabled     = Boolean(enabled);
  if (minDeposit  !== undefined) patch.minDeposit  = Number(minDeposit) || 0;

  const updated = await updateWallet(id, patch);
  if (!updated) return res.status(404).json({ success: false, error: 'Wallet not found' });

  appendAudit({
    event:   'wallet_address_updated',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    meta:    { walletId: id, symbol: updated.symbol, network: updated.network, patch },
  });

  return res.json({ success: true, wallet: updated });
}
