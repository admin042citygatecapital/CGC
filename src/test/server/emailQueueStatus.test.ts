import { describe, expect, it } from 'vitest';
import { toDatabaseEmailStatus, toPublicEmailStatus } from '../../server/lib/emailQueue';

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
});
