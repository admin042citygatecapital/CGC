import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { recordOnboardingProviderEvent } from '../../../../lib/onboardingProviderStore.js';
import {
  assertApprovedProvider, OnboardingProviderError, providerWebhookSecret,
  validateProviderWebhookPayload, verifyProviderWebhook,
} from '../../../../lib/onboardingProviderWebhook.js';

type RawRequest = Request & { rawBody?: Buffer };

export default async function handler(req: Request, res: Response) {
  try {
    const providerCode = assertApprovedProvider(String(req.params.provider ?? ''));
    const rawBody = (req as RawRequest).rawBody;
    if (!rawBody?.length) throw new OnboardingProviderError('Raw webhook body is unavailable.', 'RAW_BODY_REQUIRED', 400);
    const eventId = String(req.get('x-cgc-event-id') ?? '');
    const timestamp = String(req.get('x-cgc-timestamp') ?? '');
    const signature = String(req.get('x-cgc-signature') ?? '');
    verifyProviderWebhook({ rawBody, eventId, timestamp, signature, secret: providerWebhookSecret(providerCode) });
    const payload = validateProviderWebhookPayload(req.body);
    const result = await recordOnboardingProviderEvent({
      ...payload, eventId, providerCode,
      payloadSha256: crypto.createHash('sha256').update(rawBody).digest('hex'),
    });
    return res.status(202).json({ ok: true, eventId: result.id, accepted: result.accepted });
  } catch (error) {
    if (error instanceof OnboardingProviderError) return res.status(error.status).json({ error: error.message, code: error.code });
    console.error('onboarding.provider.webhook.error', error);
    return res.status(500).json({ error: 'Provider webhook processing failed.', code: 'INTERNAL_ERROR' });
  }
}
