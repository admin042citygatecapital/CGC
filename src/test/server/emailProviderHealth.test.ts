import { describe, expect, it } from 'vitest';
import { assessResendHealth } from '../../server/lib/emailProviderHealth.js';
import type { QueuedEmail } from '../../server/lib/emailQueue.js';

function log(status: QueuedEmail['status'], at: string): QueuedEmail {
  return {
    id: `${status}-${at}`, to: 'redacted@example.test', subject: 'test', html: '', status,
    attempts: 1, maxAttempts: 5, errorMessage: status === 'failed' ? 'provider rejected request' : '',
    createdAt: at, lastAttemptAt: at, sentAt: status === 'sent' ? at : '',
  };
}

describe('Resend provider health assessment', () => {
  const now = Date.parse('2026-08-12T12:00:00Z');

  it('treats a live provider verification as healthy', () => {
    expect(assessResendHealth(true, [], { status: 'verified' }, now)).toMatchObject({
      status: 'healthy', healthy: true, evidence: 'live_api',
    });
  });

  it('uses a recent accepted delivery for a permission-limited sending key', () => {
    const result = assessResendHealth(true, [log('sent', '2026-08-11T12:00:00Z')], { status: 'permission_limited' }, now);
    expect(result).toMatchObject({ status: 'healthy', healthy: true, evidence: 'recent_delivery' });
  });

  it('prefers a signed provider delivery event as operational evidence', () => {
    const result = assessResendHealth(true, [], { status: 'permission_limited' }, now, [
      { eventType: 'delivered', occurredAt: '2026-08-11T12:00:00Z' },
    ]);
    expect(result).toMatchObject({ status: 'healthy', healthy: true, evidence: 'webhook_delivery' });
  });

  it('does not let old webhook evidence override an invalid current credential', () => {
    const result = assessResendHealth(true, [], { status: 'invalid' }, now, [
      { eventType: 'delivered', occurredAt: '2026-08-11T12:00:00Z' },
    ]);
    expect(result).toMatchObject({ status: 'degraded', healthy: false, evidence: 'provider_error' });
  });

  it('does not call a restricted key broken when it has no delivery evidence yet', () => {
    expect(assessResendHealth(true, [], { status: 'permission_limited' }, now)).toMatchObject({
      status: 'configured_unverified', healthy: false, evidence: 'configuration_only',
    });
  });

  it('reports an explicit authentication rejection as degraded', () => {
    expect(assessResendHealth(true, [], { status: 'invalid' }, now)).toMatchObject({
      status: 'degraded', healthy: false, evidence: 'provider_error',
    });
  });

  it('does not let an older success hide a newer failed delivery', () => {
    const result = assessResendHealth(true, [
      log('failed', '2026-08-11T13:00:00Z'),
      log('sent', '2026-08-11T12:00:00Z'),
    ], { status: 'permission_limited' }, now);
    expect(result.status).toBe('configured_unverified');
  });
});
