import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  databaseConfigured: true,
  secrets: new Map<string, string>(),
  updateUser: vi.fn(),
  deleteAllCustomerSessions: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('#runtime/secrets', () => ({
  getSecret: (name: string) => dependencies.secrets.get(name) ?? '',
}));
vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => dependencies.databaseConfigured,
}));
vi.mock('../../server/lib/userStore.js', () => ({ updateUser: dependencies.updateUser }));
vi.mock('../../server/lib/customerSessionStore.js', () => ({
  deleteAllCustomerSessions: dependencies.deleteAllCustomerSessions,
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: dependencies.createClient }));

describe('rotateCustomerPasswordCredential', () => {
  beforeEach(() => {
    dependencies.databaseConfigured = true;
    dependencies.secrets.clear();
    dependencies.secrets.set('SUPABASE_URL', 'https://project.supabase.co');
    dependencies.secrets.set('SUPABASE_SERVICE_ROLE_KEY', 'server-only-key');
    dependencies.updateUser.mockReset();
    dependencies.deleteAllCustomerSessions.mockReset().mockResolvedValue(3);
    dependencies.createClient.mockReset();
  });

  it('uses the server-only service role path and advances the credential version', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-1', credential_version: 8 },
      error: null,
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const from = vi.fn(() => ({ update }));
    dependencies.createClient.mockReturnValue({ from });

    const { rotateCustomerPasswordCredential } = await import('../../server/lib/customerCredentialRotation.js');
    const result = await rotateCustomerPasswordCredential({
      userId: 'user-1',
      passwordHash: '$argon2id$redacted-test-value',
      expectedCredentialVersion: 7,
    });

    expect(result).toEqual({ credentialVersion: 8, revokedSessions: 3 });
    expect(dependencies.updateUser).not.toHaveBeenCalled();
    expect(dependencies.createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'server-only-key',
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
    expect(update).toHaveBeenCalledWith({
      password_hash: '$argon2id$redacted-test-value',
      credential_version: 8,
      login_attempts: 0,
    });
    expect(firstEq).toHaveBeenCalledWith('id', 'user-1');
    expect(secondEq).toHaveBeenCalledWith('credential_version', 7);
    expect(dependencies.deleteAllCustomerSessions).toHaveBeenCalledWith('user-1');
  });

  it('fails closed when the server-only Supabase credential is unavailable', async () => {
    dependencies.secrets.delete('SUPABASE_SERVICE_ROLE_KEY');
    const { rotateCustomerPasswordCredential } = await import('../../server/lib/customerCredentialRotation.js');
    await expect(rotateCustomerPasswordCredential({
      userId: 'user-1',
      passwordHash: '$argon2id$redacted-test-value',
      expectedCredentialVersion: 1,
    })).rejects.toThrow('Customer credential rotation is not configured.');
    expect(dependencies.createClient).not.toHaveBeenCalled();
  });
});
