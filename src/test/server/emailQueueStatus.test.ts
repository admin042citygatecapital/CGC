import { describe, expect, it } from 'vitest';
import { toDatabaseEmailStatus, toEmailDiagnostic, toPublicEmailStatus } from '../../server/lib/emailQueue';

describe('email queue status translation', () => {
  it('stores the admin retrying state using the PostgreSQL enum value', () => {
    expect(toDatabaseEmailStatus('retrying')).toBe('sending');
  });

  it('shows an in-progress database row as retrying in the admin UI', () => {
    expect(toPublicEmailStatus('sending')).toBe('retrying');
  });

  it('passes terminal and queued states through unchanged', () => {
    expect(toDatabaseEmailStatus('queued')).toBe('queued');
    expect(toDatabaseEmailStatus('sent')).toBe('sent');
    expect(toDatabaseEmailStatus('failed')).toBe('failed');
  });

  it('removes sensitive message HTML from administration diagnostics', () => {
    const diagnostic = toEmailDiagnostic({
      id: 'email-1', to: 'customer@example.test', subject: 'Reset', html: '<p>secret reset token</p>',
      status: 'queued', attempts: 0, maxAttempts: 5, errorMessage: '', createdAt: '', lastAttemptAt: '', sentAt: '',
    });
    expect(diagnostic).not.toHaveProperty('html');
    expect(JSON.stringify(diagnostic)).not.toContain('secret reset token');
  });
});
