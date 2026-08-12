import type { Request, Response } from 'express';
import { recordVerifiedResendEvent, ResendWebhookError, verifyResendWebhook } from '../../../lib/resendWebhook.js';

type RawRequest = Request & { rawBody?: Buffer };

function header(req: Request, modern: string, legacy: string): string {
  return String(req.get(modern) ?? req.get(legacy) ?? '');
}

export default async function handler(req: Request, res: Response) {
  try {
    const rawBody = (req as RawRequest).rawBody;
    if (!rawBody?.length) throw new ResendWebhookError('Raw webhook body is required.', 'RAW_BODY_REQUIRED', 400);
    const event = verifyResendWebhook({
      rawBody,
      id: header(req, 'webhook-id', 'svix-id'),
      timestamp: header(req, 'webhook-timestamp', 'svix-timestamp'),
      signature: header(req, 'webhook-signature', 'svix-signature'),
    });
    if (!event) return res.status(202).json({ ok: true, accepted: false });
    const stored = await recordVerifiedResendEvent(event);
    console.log(JSON.stringify({
      event: 'resend.webhook.accepted',
      providerEventId: event.id,
      providerMessageId: event.messageId,
      deliveryEvent: event.eventType,
      duplicate: !stored.created,
    }));
    return res.status(stored.created ? 202 : 200).json({ ok: true, accepted: true, duplicate: !stored.created });
  } catch (error) {
    if (error instanceof ResendWebhookError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error(JSON.stringify({
      event: 'resend.webhook.failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
    return res.status(500).json({ error: 'Email event processing failed.', code: 'INTERNAL_ERROR' });
  }
}
