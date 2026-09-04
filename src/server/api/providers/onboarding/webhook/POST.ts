// PATCH: the Sumsub branch now yields one-or-more provider events (identity + screening).
// Each is recorded independently and idempotently — an already-processed event
// (EVENT_REPLAYED) is skipped rather than failing the whole delivery, so Sumsub
// redeliveries and partial retries converge. Non-Sumsub providers are unchanged.
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { recordOnboardingProviderEvent } from '../../../../lib/onboardingProviderStore.js';
import {
  assertApprovedProvider, OnboardingProviderError, providerWebhookSecret,
  mapSumsubWebhookPayload, validateProviderWebhookPayload, verifyProviderWebhook, verifySumsubWebhook,
  type ProviderWebhookPayload,
} from '../../../../lib/onboardingProviderWebhook.js';

type RawRequest = Request & { rawBody?: Buffer };

export default async function handler(req: Request, res: Response) {
  try {
    const providerCode = assertApprovedProvider(String(req.params.provider ?? ''));
    const rawBody = (req as RawRequest).rawBody;
    if (!rawBody?.length) throw new OnboardingProviderError('Raw webhook body is unavailable.', 'RAW_BODY_REQUIRED', 400);

    const events: Array<{ eventId: string; payload: ProviderWebhookPayload }> = [];
    if (providerCode === 'sumsub') {
      verifySumsubWebhook({
        rawBody,
        signature: String(req.get('x-payload-digest') ?? ''),
        algorithm: String(req.get('x-payload-digest-alg') ?? ''),
        secret: providerWebhookSecret(providerCode),
      });
      events.push(...mapSumsubWebhookPayload(req.body).events);
    } else {
      const eventId = String(req.get('x-cgc-event-id') ?? '');
      const timestamp = String(req.get('x-cgc-timestamp') ?? '');
      const signature = String(req.get('x-cgc-signature') ?? '');
      verifyProviderWebhook({ rawBody, eventId, timestamp, signature, secret: providerWebhookSecret(providerCode) });
      events.push({ eventId, payload: validateProviderWebhookPayload(req.body) });
    }

    const payloadSha256 = crypto.createHash('sha256').update(rawBody).digest('hex');
    const recorded: string[] = [];
    let replayed = 0;
    for (const event of events) {
      try {
        const result = await recordOnboardingProviderEvent({
          ...event.payload, eventId: event.eventId, providerCode, payloadSha256,
        });
        recorded.push(result.id);
      } catch (error) {
        // A redelivered or partially-retried webhook may replay an event we already
        // stored. Treat that as success for this event and continue with the rest.
        if (error instanceof OnboardingProviderError && error.code === 'EVENT_REPLAYED') { replayed += 1; continue; }
        throw error;
      }
    }

    return res.status(202).json({ ok: true, recorded, replayed });
  } catch (error) {
    if (error instanceof OnboardingProviderError) return res.status(error.status).json({ error: error.message, code: error.code });
    console.error('onboarding.provider.webhook.error', error);
    return res.status(500).json({ error: 'Provider webhook processing failed.', code: 'INTERNAL_ERROR' });
  }
}
