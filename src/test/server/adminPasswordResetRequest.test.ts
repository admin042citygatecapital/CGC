import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  findAdminByEmail: vi.fn(),
  issueResetToken: vi.fn(),
  sendAdminPasswordResetEmail: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock('../../server/lib/adminCredentials.js', () => ({ findAdminByEmail: dependencies.findAdminByEmail }));
vi.mock('../../server/lib/adminResetTokenStore.js', () => ({
  issueResetToken: dependencies.issueResetToken,
  EXPIRY_MINUTES: 45,
}));
vi.mock('../../server/lib/emailService.js', () => ({ sendAdminPasswordResetEmail: dependencies.sendAdminPasswordResetEmail }));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit: dependencies.appendAudit }));

function invoke(email: string | undefined, ip = '127.0.0.1') {
  const result: { status: number; body?: unknown } = { status: 200 };
  const req = { body: { email }, ip } as unknown as Request;
  const res = {
    status(code: number) { result.status = code; return res; },
    json(value: unknown) { result.body = value; return res; },
  } as unknown as Response;
  return { run: async () => {
    const handler = (await import('../../server/api/admin/auth/password-reset/POST.js')).default;
    await handler(req, res);
    await new Promise(setImmediate); // let fire-and-forget promises settle
    return result;
  } };
}

describe('admin password reset request boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.findAdminByEmail.mockResolvedValue({ id: 'admin_001', email: 'admin@citygate.capital', name: 'Super Admin' });
    dependencies.issueResetToken.mockResolvedValue('a'.repeat(64));
    dependencies.sendAdminPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('answers 400 without touching the token store when email is missing', async () => {
    const { run } = invoke(undefined);
    expect((await run()).status).toBe(400);
    expect(dependencies.issueResetToken).not.toHaveBeenCalled();
  });

  it('keeps the generic response when persistence fails and never sends a dead link', async () => {
    dependencies.issueResetToken.mockResolvedValue(null);
    const { run } = invoke('admin@citygate.capital');

    const result = await run();
    expect(result.status).toBe(200);
    expect((result.body as { message: string }).message).toContain('If that email is registered');
    expect(dependencies.sendAdminPasswordResetEmail).not.toHaveBeenCalled();
    expect(dependencies.appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_password_reset_issue_failed',
    }));
  });

  it('audits email delivery failure server-side while keeping the generic response', async () => {
    dependencies.sendAdminPasswordResetEmail.mockRejectedValue(new Error('smtp down'));
    const { run } = invoke('admin@citygate.capital');

    const result = await run();
    expect(result.status).toBe(200);
    expect(dependencies.sendAdminPasswordResetEmail).toHaveBeenCalledTimes(1);
    // The raw token must never reach the audit trail.
    const failureAudit = dependencies.appendAudit.mock.calls
      .map(call => call[0])
      .find((payload: { event: string }) => payload.event === 'admin_password_reset_email_failed');
    expect(failureAudit).toBeDefined();
    expect(JSON.stringify(failureAudit)).not.toContain('a'.repeat(64));
  });

  it('returns the same generic message for unknown emails without issuing tokens', async () => {
    dependencies.findAdminByEmail.mockResolvedValue(undefined);
    const { run } = invoke('nobody@citygate.capital');

    const result = await run();
    expect(result.status).toBe(200);
    expect(dependencies.issueResetToken).not.toHaveBeenCalled();
    expect(dependencies.sendAdminPasswordResetEmail).not.toHaveBeenCalled();
    expect((result.body as { message: string }).message)
      .toBe('If that email is registered, a reset link has been sent. Check your inbox.');
  });
});