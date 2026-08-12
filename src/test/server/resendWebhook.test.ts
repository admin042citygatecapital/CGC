import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ResendWebhookError, verifyResendWebhook } from '../../server/lib/resendWebhook.js';

const secretBytes = Buffer.from('city-gate-resend-webhook-test-key');
const secret = `whsec_${secretBytes.toString('base64')}`;

function signedEvent(overrides: Record<string, unknown> = {}, timestamp = Math.floor(Date.now() / 1000)) {
  const id = 'event_test_123456';
  const payload = Buffer.from(JSON.stringify({
    type: 'email.delivered',
    created_at: new Date(timestamp * 1000).toISOString(),
    data: {
      email_id: 'message_test_123456',
      to: ['customer@example.test'],
      subject: 'must never be stored',
    },
    ...overrides,
  }));
  const signature = crypto.createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${payload.toString('utf8')}`)
    .digest('base64');
  return { rawBody: payload, id, timestamp: String(timestamp), signature: `v1,${signature}`, secret };
}

describe('Resend webhook verification', () => {
  it('accepts an authentic delivery event and retains metadata only', () => {
    const input = signedEvent();
    const result = verifyResendWebhook(input);
    expect(result).toMatchObject({
      id: input.id,
      messageId: 'message_test_123456',
      eventType: 'delivered',
    });
    expect(result?.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('customer@example.test');
    expect(JSON.stringify(result)).not.toContain('must never be stored');
  });

  it('rejects a tampered payload', () => {
    const input = signedEvent();
    input.rawBody = Buffer.from(input.rawBody.toString('utf8').replace('delivered', 'bounced'));
    expect(() => verifyResendWebhook(input)).toThrowError(ResendWebhookError);
  });

  it('rejects stale signed events', () => {
    const input = signedEvent({}, Math.floor(Date.now() / 1000) - 3600);
    expect(() => verifyResendWebhook(input)).toThrowError(ResendWebhookError);
  });

  it('acknowledges unsupported event types without storing them', () => {
    expect(verifyResendWebhook(signedEvent({ type: 'domain.updated' }))).toBeNull();
  });
});
