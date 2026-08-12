import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { Resend, type WebhookEventPayload } from 'resend';
import { getSecret } from '#runtime/secrets';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { emailProviderEvents } from '../db/schema.js';

export type ResendDeliveryEventType = typeof emailProviderEvents.$inferSelect.eventType;

export interface VerifiedResendEvent {
  id: string;
  messageId: string;
  eventType: ResendDeliveryEventType;
  occurredAt: Date;
  payloadSha256: string;
}

export interface ResendDeliveryEvidence {
  eventType: ResendDeliveryEventType;
  occurredAt: string;
}

export class ResendWebhookError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
  }
}

const EMAIL_EVENT_MAP: Record<string, ResendDeliveryEventType> = {
  'email.sent': 'sent',
  'email.scheduled': 'scheduled',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.complained': 'complained',
  'email.bounced': 'bounced',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
};

const verifier = new Resend('re_local_webhook_verifier');

function signingSecret(environment = process.env): string {
  return String(getSecret('RESEND_WEBHOOK_SIGNING_SECRET') ?? environment.RESEND_WEBHOOK_SIGNING_SECRET ?? '').trim();
}

function safeIdentifier(value: unknown, name: string): string {
  const text = String(value ?? '').trim();
  if (text.length < 8 || text.length > 200 || /\s/.test(text)) {
    throw new ResendWebhookError(`Invalid ${name}.`, 'INVALID_EVENT', 400);
  }
  return text;
}

export function verifyResendWebhook(input: {
  rawBody: Buffer;
  id: string;
  timestamp: string;
  signature: string;
  secret?: string;
}): VerifiedResendEvent | null {
  if (!input.rawBody.length) throw new ResendWebhookError('Raw webhook body is required.', 'RAW_BODY_REQUIRED', 400);
  const secret = input.secret?.trim() || signingSecret();
  if (secret.length < 24) throw new ResendWebhookError('Resend webhook verification is not configured.', 'WEBHOOK_SECRET_MISSING', 503);
  const id = safeIdentifier(input.id, 'webhook event identifier');
  if (!input.timestamp || !input.signature) throw new ResendWebhookError('Webhook signature headers are required.', 'SIGNATURE_REQUIRED', 401);

  let payload: WebhookEventPayload;
  try {
    payload = verifier.webhooks.verify({
      payload: input.rawBody.toString('utf8'),
      headers: { id, timestamp: input.timestamp, signature: input.signature },
      webhookSecret: secret,
    });
  } catch {
    throw new ResendWebhookError('Webhook signature is invalid or expired.', 'INVALID_SIGNATURE', 401);
  }

  const eventType = EMAIL_EVENT_MAP[payload.type];
  if (!eventType) return null;
  const data = payload.data as { email_id?: unknown };
  const messageId = safeIdentifier(data.email_id, 'provider message identifier');
  const occurredAt = new Date(payload.created_at);
  if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 60_000) {
    throw new ResendWebhookError('Invalid provider event timestamp.', 'INVALID_EVENT_TIMESTAMP', 400);
  }
  return {
    id,
    messageId,
    eventType,
    occurredAt,
    payloadSha256: crypto.createHash('sha256').update(input.rawBody).digest('hex'),
  };
}

export async function recordVerifiedResendEvent(event: VerifiedResendEvent): Promise<{ created: boolean }> {
  if (!isDatabaseConfigured()) throw new ResendWebhookError('Email event storage is unavailable.', 'DATABASE_REQUIRED', 503);
  const rows = await getDb().insert(emailProviderEvents).values({
    id: event.id,
    provider: 'resend',
    messageId: event.messageId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    payloadSha256: event.payloadSha256,
  }).onConflictDoNothing().returning({ id: emailProviderEvents.id });
  return { created: Boolean(rows[0]) };
}

export async function getRecentResendDeliveryEvents(limit = 100): Promise<ResendDeliveryEvidence[]> {
  if (!isDatabaseConfigured()) return [];
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const rows = await getDb().select({
    eventType: emailProviderEvents.eventType,
    occurredAt: emailProviderEvents.occurredAt,
  }).from(emailProviderEvents)
    .where(eq(emailProviderEvents.provider, 'resend'))
    .orderBy(desc(emailProviderEvents.occurredAt))
    .limit(safeLimit);
  return rows.map(row => ({ eventType: row.eventType, occurredAt: row.occurredAt.toISOString() }));
}
