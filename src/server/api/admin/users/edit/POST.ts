/**
 * POST /api/admin/users/edit
 * Full client account editor — SUPER_ADMIN only.
 *
 * Security hardening (SAST object-injection fixes):
 *  - userId validated with safeParseId() — rejects __proto__, path traversal, etc.
 *  - patch filtered to ALLOWED_FIELDS allowlist before any store write
 *  - all string values sanitized with sanitizeString()
 *  - enum fields (accountTier, primaryCurrency) validated
 *    against explicit allowlists — rejects arbitrary strings
 *  - stripDangerousKeys() applied to the final patch as a last-resort guard
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import {
  safeParseId,
  sanitizeString,
  isOneOf,
  stripDangerousKeys,
} from '../../../../lib/inputValidator.js';
import { requireFinancialOperations } from '../../../../lib/platformMode.js';

// Fields the admin is allowed to patch
const ALLOWED_FIELDS = new Set([
  'name', 'email', 'phone', 'country',
  'balance',
  'bankName', 'bankAccountNumber', 'bankRoutingNumber', 'bankSwift', 'bankIban',
  'walletBtc', 'walletEth', 'walletUsdt', 'walletSol',
  'address', 'city', 'postalCode',
  'primaryCurrency',
  'accountTier',
]);

// Enum allowlists for fields that must match a fixed set of values
const TIER_VALUES      = ['personal','savings','business'] as const;
const CURRENCY_VALUES  = ['USD','EUR','GBP','BTC','ETH','USDT','BNB','SOL','CHF','JPY','CAD','AUD','SGD','AED','NGN'] as const;

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const rawBody = req.body as { userId?: unknown; patch?: unknown };

  // Validate userId
  const userId = safeParseId(rawBody.userId);
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required and must be a valid ID' });

  // Validate patch shape
  if (!rawBody.patch || typeof rawBody.patch !== 'object' || Array.isArray(rawBody.patch)) {
    return res.status(400).json({ ok: false, error: 'patch must be a plain object' });
  }

  const financialFields = new Set([
    'balance', 'bankName', 'bankAccountNumber', 'bankRoutingNumber', 'bankSwift', 'bankIban',
    'walletBtc', 'walletEth', 'walletUsdt', 'walletSol',
  ]);
  if (Object.keys(rawBody.patch as Record<string, unknown>).some(key => financialFields.has(key)) && !requireFinancialOperations(res)) return;

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  // Build safe patch: allowlist fields + sanitize values + validate enums
  const safePatch: Record<string, unknown> = {};
  const previousValues: Record<string, unknown> = {};
  const rejectedFields: string[] = [];

  for (const [key, value] of Object.entries(rawBody.patch as Record<string, unknown>)) {
    // Block prototype-polluting keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      rejectedFields.push(key);
      continue;
    }
    // Block fields not in the allowlist
    if (!ALLOWED_FIELDS.has(key)) continue;

    previousValues[key] = (user as unknown as Record<string, unknown>)[key];

    // Per-field type and enum validation
    switch (key) {
      case 'accountTier': {
        const v = isOneOf(value, TIER_VALUES);
        if (!v) { rejectedFields.push(`${key}:invalid_enum`); continue; }
        safePatch[key] = v;
        break;
      }
      case 'primaryCurrency': {
        const v = isOneOf(value, CURRENCY_VALUES);
        if (!v) { rejectedFields.push(`${key}:invalid_enum`); continue; }
        safePatch[key] = v;
        break;
      }
      case 'balance': {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) { rejectedFields.push(`${key}:invalid_number`); continue; }
        safePatch[key] = Math.round(n * 100) / 100;
        break;
      }
      default:
        // All remaining allowed fields are free-text strings
        safePatch[key] = sanitizeString(value, 200);
    }
  }

  if (Object.keys(safePatch).length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'No valid fields to update',
      rejectedFields: rejectedFields.length ? rejectedFields : undefined,
    });
  }

  // Final prototype-pollution guard before store write
  const guardedPatch = stripDangerousKeys(safePatch);

  await appendCriticalAudit({ event: 'admin_client_edit_intent', adminId: session.adminId, userId,
    email: session.email, ip: req.ip ?? 'unknown', meta: { targetEmail: user.email, fields: Object.keys(safePatch), previous: previousValues } });
  const updated = await updateUser(userId, guardedPatch as Parameters<typeof updateUser>[1]);
  if (!updated) return res.status(500).json({ ok: false, error: 'Update failed' });

  appendAudit({
    event:   'admin_client_edit',
    adminId: session.adminId,
    userId,
    email:   user.email,
    ip:      req.ip ?? 'unknown',
    meta: {
      fields:         Object.keys(safePatch),
      previous:       previousValues,
      updated:        safePatch,
      rejectedFields: rejectedFields.length ? rejectedFields : undefined,
    },
  });

  return res.json({ ok: true, user: updated });
}
