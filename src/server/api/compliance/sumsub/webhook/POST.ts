/**
 * POST /api/compliance/sumsub/webhook
 *
 * Accepts provider callbacks for SumSub verification outcomes and maps them into
 * customer KYC status in this platform. This endpoint accepts either:
 * - static token in header: x-sumsub-webhook-token or x-webhook-token
 * - HMAC in header: x-sumsub-signature (optional) with SUMSUB_WEBHOOK_SECRET
 */
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { appendAudit } from '../../../../lib/auditLog.js';
import { findUserByEmail, findUserById, updateUser } from '../../../../lib/userStore.js';
import { getSecret } from '#airo/secrets';

type UnknownRecord = Record<string, unknown>;

interface SumSubWebhookPayload {
  type?: string;
  event?: string;
  status?: string;
  reviewStatus?: string;
  result?: string;
  userId?: string;
  applicantId?: string;
  externalUserId?: string;
  email?: string;
  payload?: UnknownRecord;
  data?: UnknownRecord;
  reviewResult?: UnknownRecord;
  reason?: string;
}

type KycDecision = 'approved' | 'rejected' | 'pending' | 'unknown';
type KycPatch = {
  kycStatus: 'not_submitted' | 'submitted' | 'approved' | 'rejected';
  kycSubmittedAt?: string;
  kycApprovedAt?: string;
  kycRejectedAt?: string;
  kycRejectionReason?: string;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nowIso() {
  return new Date().toISOString();
}

function firstString(values: unknown[]): string {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return '';
}

function normalizeDecision(raw: string): KycDecision {
  const value = raw.trim().toLowerCase();
  if (!value) return 'unknown';
  if (['approved', 'clear', 'green', 'accept', 'trusted', 'completed'].includes(value)) return 'approved';
  if (['rejected', 'declined', 'red', 'black', 'error', 'failed', 'denied'].includes(value)) return 'rejected';
  if (['pending', 'in_review', 'reviewed', 'submitted', 'review', 'pending_review', 'awaiting'].includes(value)) return 'pending';
  return 'unknown';
}

function readStatus(payload: UnknownRecord): string {
  const direct = payload as SumSubWebhookPayload;
  const nested = (direct.payload as UnknownRecord | undefined) ?? {};
  const nestedNested = (direct.data as UnknownRecord | undefined) ?? {};
  const review = (direct.reviewResult as UnknownRecord | undefined) ?? {};
  return firstString([
    direct.status,
    direct.reviewStatus,
    direct.result,
    direct.event,
    nested.status,
    nested.reviewStatus,
    nested.result,
    nested.type,
    nested.event,
    review.status,
    review.reviewStatus,
    review.result,
    nestedNested.status,
    nestedNested.reviewStatus,
    nestedNested.result,
    nestedNested.type,
    nestedNested.event,
  ]);
}

function timingSafeMatch(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function normalizeSignature(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed.includes('=')) return trimmed;
  const parts = trimmed.split('=');
  return asString(parts[1] || '');
}

function readHeaderValue(req: Request, ...names: string[]): string {
  for (const name of names) {
    const value = req.get(name);
    if (value) return asString(value);
  }
  return '';
}

function webhookPayloadForSig(payload: UnknownRecord): string {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return '';
  }
}

function verifyWebhook(req: Request, payload: UnknownRecord): boolean {
  const sharedToken = asString(getSecret('SUMSUB_WEBHOOK_TOKEN'));
  const sharedSecret = asString(getSecret('SUMSUB_WEBHOOK_SECRET'));
  if (!sharedToken && !sharedSecret) return true;

  const headerToken = readHeaderValue(req, 'x-sumsub-webhook-token', 'x-webhook-token', 'x-sumsub-token');
  if (sharedToken && headerToken && timingSafeMatch(sharedToken, headerToken)) return true;

  const providedSignature = normalizeSignature(
    readHeaderValue(req, 'x-sumsub-signature', 'x-signature', 'x-sumsub-hmac-sha256')
  );
  if (sharedSecret && providedSignature) {
    const serialized = webhookPayloadForSig(payload);
    if (!serialized) return false;
    const expected = crypto.createHmac('sha256', sharedSecret).update(serialized).digest('hex');
    return timingSafeMatch(expected, providedSignature);
  }

  return false;
}

export default async function handler(req: Request, res: Response) {
  const rawBody = req.body as UnknownRecord;
  if (!rawBody || Array.isArray(rawBody) || typeof rawBody !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid payload' });
  }

  const requestPayload = rawBody as SumSubWebhookPayload;
  const payload = (requestPayload.payload as UnknownRecord) ?? {};
  const requestor = payload as SumSubWebhookPayload;

  if (!verifyWebhook(req, requestPayload)) {
    return res.status(401).json({ ok: false, error: 'Webhook verification failed' });
  }

  const ids = {
    userId: firstString([requestPayload.userId, requestor.userId]),
    applicantId: firstString([requestPayload.applicantId, requestor.applicantId]),
    externalUserId: firstString([requestPayload.externalUserId, requestor.externalUserId]),
  };
  const rawEmail = firstString([requestPayload.email, requestor.email]);
  const userId = ids.userId || ids.externalUserId || ids.applicantId;
  if (!userId && !rawEmail) {
    return res.status(400).json({ ok: false, error: 'userId or email is required' });
  }

  const user = userId
    ? await findUserById(userId)
    : await findUserByEmail(rawEmail);
  if (!user) {
    return res.status(404).json({ ok: false, error: 'User not found' });
  }

  const statusText = readStatus({ ...requestPayload, ...(payload || {}) });
  const decision = normalizeDecision(statusText);
  const patch: KycPatch = { kycStatus: decision === 'rejected' ? 'rejected' : decision === 'approved' ? 'approved' : 'submitted' };

  if (decision === 'approved') {
    patch.kycApprovedAt = nowIso();
    patch.kycSubmittedAt = user.kycSubmittedAt || nowIso();
    patch.kycRejectedAt = '';
    patch.kycRejectionReason = '';
  } else if (decision === 'rejected') {
    patch.kycRejectedAt = nowIso();
    patch.kycRejectionReason = requestPayload.reason || 'Automated compliance rejection';
  } else {
    if (!user.kycSubmittedAt) patch.kycSubmittedAt = nowIso();
  }

  const updated = await updateUser(user.id, patch);
  if (!updated) {
    return res.status(404).json({ ok: false, error: 'Failed to update user' });
  }

  appendAudit({
    event: 'sumsub_webhook_processed',
    userId: user.id,
    email: user.email,
    ip: req.ip ?? 'unknown',
    meta: {
      status: decision,
      provider: 'sumsub',
      event: requestPayload.type || requestPayload.event || requestor.type || requestor.event || 'unknown',
      applicantId: ids.applicantId,
      externalUserId: ids.externalUserId,
      rawStatus: statusText,
    },
  });

  return res.json({
    ok: true,
    provider: 'sumsub',
    userId: user.id,
    decision,
    message: `KYC status set to ${patch.kycStatus}.`,
  });
}
