import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  enqueueEmail: vi.fn(),
  getResolvedAccountId: vi.fn(),
  getSecret: vi.fn(),
  getValidAccessToken: vi.fn(),
  invalidateTokenCache: vi.fn(),
  smtpSend: vi.fn(),
}));

vi.mock('#runtime/secrets', () => ({ getSecret: dependencies.getSecret }));
vi.mock('../../server/lib/zohoTokenStore.js', () => ({
  getResolvedAccountId: dependencies.getResolvedAccountId,
  getValidAccessToken: dependencies.getValidAccessToken,
  invalidateTokenCache: dependencies.invalidateTokenCache,
}));
vi.mock('../../server/lib/smtpTransport.js', () => ({
  sendEmail: dependencies.smtpSend,
}));
vi.mock('../../server/lib/emailQueue.js', () => ({
  enqueueEmail: dependencies.enqueueEmail,
}));

import {
  sendAdminFailedOtpAlertEmail,
  sendAdminLoginAlertEmail,
  sendAdminNewUserAlert,
  sendAdminOtpEmail,
  sendAdminPasswordResetEmail,
  sendBalanceAdjustmentEmail,
} from '../../server/lib/emailService.js';
import { escapeEmailHtml } from '../../server/lib/emailLayout.js';

const originalE2eMode = process.env.E2E_TEST_MODE;
const originalE2eOtp = process.env.E2E_ADMIN_OTP;
const originalNodeEnv = process.env.NODE_ENV;

function restoreEnvironment() {
  if (originalE2eMode === undefined) delete process.env.E2E_TEST_MODE;
  else process.env.E2E_TEST_MODE = originalE2eMode;

  if (originalE2eOtp === undefined) delete process.env.E2E_ADMIN_OTP;
  else process.env.E2E_ADMIN_OTP = originalE2eOtp;

  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
}

describe('admin OTP delivery contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.E2E_TEST_MODE;
    delete process.env.E2E_ADMIN_OTP;
    dependencies.enqueueEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    restoreEnvironment();
    vi.restoreAllMocks();
  });

  const untrustedText = `O'Connor & <img src=x onerror=alert(1)>`;
  const recipient = 'admin@example.test';
  it.each([
    ['registration', () => sendAdminNewUserAlert(recipient, { name: untrustedText, email: untrustedText, country: untrustedText, ip: untrustedText })],
    ['login', () => sendAdminLoginAlertEmail(recipient, untrustedText, untrustedText, '', untrustedText)],
    ['OTP', () => sendAdminOtpEmail(recipient, untrustedText, untrustedText, untrustedText, '')],
    ['failed OTP', () => sendAdminFailedOtpAlertEmail(recipient, untrustedText, untrustedText, '', 2)],
    ['password reset', () => sendAdminPasswordResetEmail(recipient, untrustedText, 'synthetic-reset-token', untrustedText, 15)],
    ['record notification', () => sendBalanceAdjustmentEmail(recipient, untrustedText, 'credit', 1, 0, 1, untrustedText)],
  ] as const)('escapes untrusted text in %s HTML without changing the recipient', async (_label, sendNotification) => {
    dependencies.smtpSend.mockResolvedValue({ success: true, attempts: 1, durationMs: 1 });
    await sendNotification();
    expect(dependencies.smtpSend).toHaveBeenCalledOnce();
    const payload = dependencies.smtpSend.mock.calls[0][0];
    expect(payload.to).toBe(recipient);
    expect(payload.html).toContain(escapeEmailHtml(untrustedText));
    expect(payload.html).not.toContain(untrustedText);
    expect(payload.html).not.toContain('<img src=x');
    expect(payload.html).not.toContain('&amp;lt;img');
    expect(dependencies.enqueueEmail).not.toHaveBeenCalled();
  });

  it('rejects admin login when the OTP transport reports a failed delivery', async () => {
    const otp = '492731';
    dependencies.smtpSend.mockResolvedValue({
      success: false,
      error: 'provider rejected request',
      attempts: 1,
      durationMs: 4,
      transport: 'resend',
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(sendAdminOtpEmail(
      'admin@example.test',
      'Admin',
      otp,
      '203.0.113.10',
      'Mozilla/5.0 Test Browser',
    )).rejects.toThrow('Required email delivery failed');

    expect(dependencies.smtpSend).toHaveBeenCalledOnce();
    expect(dependencies.enqueueEmail).not.toHaveBeenCalled();
    expect(errorLog.mock.calls.flat().map(String).join('\n')).not.toContain(otp);
  });

  it('continues to queue an ordinary notification when delivery fails', async () => {
    dependencies.smtpSend.mockResolvedValue({
      success: false,
      error: 'provider unavailable',
      attempts: 3,
      durationMs: 12,
      transport: 'zoho',
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(sendAdminLoginAlertEmail(
      'admin@example.test',
      'Admin',
      '203.0.113.10',
      'Mozilla/5.0 Test Browser',
    )).resolves.toBeUndefined();

    expect(dependencies.smtpSend).toHaveBeenCalledOnce();
    expect(dependencies.enqueueEmail).toHaveBeenCalledOnce();
    expect(dependencies.enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@example.test',
      subject: expect.stringContaining('Admin Login'),
    }));
  });

  it('accepts a successfully delivered OTP without adding it to the retry queue', async () => {
    dependencies.smtpSend.mockResolvedValue({
      success: true,
      messageId: 'provider-message-1',
      attempts: 1,
      durationMs: 3,
      transport: 'resend',
    });

    await expect(sendAdminOtpEmail(
      'admin@example.test',
      'Admin',
      '492731',
      '203.0.113.10',
      'Mozilla/5.0 Test Browser',
    )).resolves.toBe('email');

    expect(dependencies.smtpSend).toHaveBeenCalledOnce();
    expect(dependencies.enqueueEmail).not.toHaveBeenCalled();
  });

  it('bypasses delivery only for the exact isolated non-production E2E code', async () => {
    process.env.NODE_ENV = 'test';
    process.env.E2E_TEST_MODE = '1';
    process.env.E2E_ADMIN_OTP = '246810';
    dependencies.smtpSend.mockResolvedValue({
      success: false,
      error: 'provider unavailable',
      attempts: 1,
      durationMs: 2,
      transport: 'none',
    });

    await expect(sendAdminOtpEmail(
      'admin@example.test',
      'Admin',
      '246810',
      '203.0.113.10',
      'Mozilla/5.0 Test Browser',
    )).resolves.toBe('local');
    expect(dependencies.smtpSend).not.toHaveBeenCalled();

    await expect(sendAdminOtpEmail(
      'admin@example.test',
      'Admin',
      '135790',
      '203.0.113.10',
      'Mozilla/5.0 Test Browser',
    )).rejects.toThrow('Required email delivery failed');
    expect(dependencies.smtpSend).toHaveBeenCalledOnce();
  });
});
