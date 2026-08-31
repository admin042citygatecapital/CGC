/**
 * PATCH /api/admin/wallets
 * Update protected wallet-address configuration. Operational activation still
 * requires the production financial-provider gate.
 * Body: { id, address?, enabled?, minDeposit?, confirmations?, reason, confirmed }
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { findWalletById, updateWallet } from '../../../lib/walletStore.js';
import { appendAudit, appendCriticalAudit } from '../../../lib/auditLog.js';
import { requireFinancialOperations } from '../../../lib/platformMode.js';
import { safeParseId, safeWalletAddress, sanitizeNote } from '../../../lib/inputValidator.js';
import { authorizeRecentAdminStepUp } from '../../../lib/rbacMiddleware.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { id: rawId, address, enabled, minDeposit, confirmations, reason, confirmed } = req.body ?? {};
  const id = safeParseId(rawId);

  if (!id) return res.status(400).json({ success: false, error: 'A valid wallet id is required.' });
  if (confirmed !== true) return res.status(400).json({ success: false, error: 'Explicit confirmation is required.' });
  const safeReason = sanitizeNote(reason);
  if (safeReason.length < 10) return res.status(400).json({ success: false, error: 'A reason of at least 10 characters is required.' });
  if (!authorizeRecentAdminStepUp(req, res)) return;

  const existing = await findWalletById(id);
  if (!existing) return res.status(404).json({ success: false, error: 'Wallet not found' });

  const patch: Record<string, unknown> = { updatedBy: session.adminId };
  if (address !== undefined) {
    const validatedAddress = safeWalletAddress(existing.symbol, address);
    if (validatedAddress === null) {
      return res.status(400).json({ success: false, error: `The address is not valid for ${existing.symbol}.` });
    }
    patch.address = validatedAddress;
  }
  if (minDeposit !== undefined) {
    const value = Number(minDeposit);
    if (!Number.isFinite(value) || value < 0) return res.status(400).json({ success: false, error: 'Minimum deposit must be a non-negative number.' });
    patch.minDeposit = value;
  }
  if (confirmations !== undefined) {
    const value = Number(confirmations);
    if (!Number.isInteger(value) || value < 0 || value > 10_000) return res.status(400).json({ success: false, error: 'Confirmations must be an integer between 0 and 10000.' });
    patch.confirmations = value;
  }
  if (enabled !== undefined) {
    if (Boolean(enabled) && !requireFinancialOperations(res)) return;
    patch.enabled = Boolean(enabled);
  }

  const addressFingerprint = (value: string) => value
    ? crypto.createHash('sha256').update(value).digest('hex')
    : null;
  await appendCriticalAudit({
    event: 'wallet_configuration_update_intent',
    adminId: session.adminId,
    ip: req.ip ?? 'unknown',
    reason: safeReason,
    meta: {
      walletId: id,
      symbol: existing.symbol,
      network: existing.network,
      before: { enabled: existing.enabled, minDeposit: existing.minDeposit, confirmations: existing.confirmations, addressFingerprint: addressFingerprint(existing.address) },
      requested: { enabled: patch.enabled, minDeposit: patch.minDeposit, confirmations: patch.confirmations, addressFingerprint: typeof patch.address === 'string' ? addressFingerprint(patch.address) : undefined },
    },
  });

  const updated = await updateWallet(id, patch);
  if (!updated) return res.status(404).json({ success: false, error: 'Wallet not found' });

  appendAudit({
    event:   'wallet_address_updated',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    reason:  safeReason,
    meta:    {
      walletId: id,
      symbol: updated.symbol,
      network: updated.network,
      enabled: updated.enabled,
      minDeposit: updated.minDeposit,
      confirmations: updated.confirmations,
      addressFingerprint: addressFingerprint(updated.address),
    },
  });

  return res.json({ success: true, wallet: updated, executionEnabled: false });
}
