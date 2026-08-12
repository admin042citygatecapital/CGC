import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  getSecret: vi.fn((name: string) => name === 'ZOHO_ACCESS_TOKEN' ? 'test-oauth-token-must-not-be-logged' : undefined),
  getValidAccessToken: vi.fn(),
  invalidateTokenCache: vi.fn(),
  getResolvedAccountId: vi.fn(() => 'test-account-id-must-not-be-logged'),
}));

vi.mock('#runtime/secrets', () => ({ getSecret: dependencies.getSecret }));
vi.mock('../../server/lib/zohoTokenStore.js', () => ({
  getValidAccessToken: dependencies.getValidAccessToken,
  invalidateTokenCache: dependencies.invalidateTokenCache,
  getResolvedAccountId: dependencies.getResolvedAccountId,
}));

import { sendMail } from '../../server/lib/emailService.js';

describe('email transport security and delivery contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('submits the message to Zoho and never logs its token-bearing content or credentials', async () => {
    const sensitiveMarker = 'otp-492731-reset-token-private';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ status: { code: 200 }, data: { messageId: 'provider-message-1' } })),
    });
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await sendMail({
      to: 'delivery-contract@example.test',
      subject: 'Security delivery contract',
      html: `<p>${sensitiveMarker}</p>`,
    });

    expect(result).toMatchObject({ success: true, messageId: 'provider-message-1', attempts: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mail.zoho.com/api/accounts/test-account-id-must-not-be-logged/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Zoho-oauthtoken test-oauth-token-must-not-be-logged' }),
      }),
    );

    const outboundBody = String((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(outboundBody).toContain(sensitiveMarker);
    const renderedLogs = log.mock.calls.flat().map(String).join('\n');
    expect(renderedLogs).toContain('email.sending');
    expect(renderedLogs).toContain('email.sent');
    expect(renderedLogs).not.toContain(sensitiveMarker);
    expect(renderedLogs).not.toContain('test-oauth-token-must-not-be-logged');
    expect(renderedLogs).not.toContain('test-account-id-must-not-be-logged');
    expect(renderedLogs).not.toContain('bodyPreview');
  });
});
