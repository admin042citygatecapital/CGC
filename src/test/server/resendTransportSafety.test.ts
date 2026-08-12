import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  send: vi.fn(),
  get: vi.fn(),
  domainsList: vi.fn(),
  getSecret: vi.fn((name: string) => {
    if (name === 'RESEND_API_KEY') return 're_test_api_key_must_not_be_logged';
    if (name === 'MAIL_FROM_ADDRESS') return 'noreply@citygate.capital';
    return undefined;
  }),
}));

vi.mock('#runtime/secrets', () => ({ getSecret: dependencies.getSecret }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: dependencies.send, get: dependencies.get };
    domains = { list: dependencies.domainsList };
  },
}));

import { getEmailDeliveryStatus, sendEmail, verifyManualSmtp } from '../../server/lib/smtpTransport.js';

describe('Resend transport security and delivery contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.send.mockResolvedValue({ data: { id: 'resend-message-1' }, error: null });
    dependencies.get.mockResolvedValue({ data: { last_event: 'delivered' }, error: null });
    dependencies.domainsList.mockResolvedValue({ data: { data: [] }, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts an outbound message, reports provider delivery, and never logs content or the API key', async () => {
    const sensitiveMarker = 'verification-token-otp-837421-private';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const sent = await sendEmail({
      to: 'delivery-contract@example.test',
      subject: 'Resend delivery contract',
      html: `<p>${sensitiveMarker}</p>`,
    });
    expect(sent).toMatchObject({ success: true, messageId: 'resend-message-1', transport: 'resend' });
    expect(dependencies.send).toHaveBeenCalledWith(expect.objectContaining({
      from: 'noreply@citygate.capital',
      to: 'delivery-contract@example.test',
      html: `<p>${sensitiveMarker}</p>`,
    }));

    await expect(getEmailDeliveryStatus('resend-message-1')).resolves.toEqual({ status: 'delivered' });
    await expect(verifyManualSmtp()).resolves.toEqual({ ok: true });

    const renderedLogs = log.mock.calls.flat().map(String).join('\n');
    expect(renderedLogs).toContain('email.sent');
    expect(renderedLogs).not.toContain(sensitiveMarker);
    expect(renderedLogs).not.toContain('re_test_api_key_must_not_be_logged');
  });
});
