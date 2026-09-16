/**
 * Email template store and the application-started notice - City Gate Capital.
 *
 * The catalogue is the admin-editable source; the transactional sender must
 * resolve its template with a built-in fallback and must never throw.
 */
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enqueued: [] as unknown[],
}));

vi.mock('#runtime/secrets', () => ({ getSecret: () => null }));
vi.mock('../../server/lib/zohoTokenStore.js', () => ({
  getValidAccessToken: vi.fn(async () => null),
  invalidateTokenCache: vi.fn(),
  getResolvedAccountId: vi.fn(() => null),
}));
vi.mock('../../server/lib/smtpTransport.js', () => ({
  sendEmail: vi.fn(async () => ({ success: true, attempts: 1, durationMs: 0 })),
}));
vi.mock('../../server/lib/emailQueue.js', () => ({
  enqueueEmail: vi.fn((payload: unknown) => {
    mocks.enqueued.push(payload);
    return Promise.resolve(undefined);
  }),
}));

import { getTemplate, getDefaultTemplate, renderTemplate } from '../../server/lib/emailTemplateStore.js';
import { sendApplicationStartedEmail } from '../../server/lib/emailService.js';

describe('email template catalogue', () => {
  it('exposes the default welcome template', () => {
    const template = getTemplate('welcome');
    expect(template).toBeDefined();
    expect(template?.subject).toContain('Welcome');
  });

  it('getDefaultTemplate returns an immutable copy of the built-in', () => {
    const builtIn = getDefaultTemplate('email_verification');
    expect(builtIn).toBeDefined();
    expect(builtIn?.body).toContain('{verification_link}');
  });

  it('renders provided placeholders in subject and body and leaves the rest', () => {
    const rendered = renderTemplate(
      {
        id: 'welcome', name: 'Welcome Email', description: '', category: 'account',
        subject: 'Hi {user_name}!', body: 'Ref {reference} for {user_name} on {date}.',
        variables: [], updatedAt: '', updatedBy: 'system',
      },
      { user_name: 'Ann', reference: 'CGC-1A2B3C4D' },
    );
    expect(rendered.subject).toBe('Hi Ann!');
    expect(rendered.body).toBe('Ref CGC-1A2B3C4D for Ann on {date}.');
  });
});

describe('sendApplicationStartedEmail - best-effort notice', () => {
  it('resolves without throwing while the transport is not configured', async () => {
    await expect(
      sendApplicationStartedEmail('anna@example.test', 'Anna', 'CGC-1A2B3C4D', 'PERSONAL'),
    ).resolves.toBeUndefined();
  });

  it('short-circuits for an empty recipient', async () => {
    await expect(
      sendApplicationStartedEmail('', 'Anna', 'CGC-1A2B3C4D', 'PERSONAL'),
    ).resolves.toBeUndefined();
    expect(mocks.enqueued).toHaveLength(0);
  });
});
