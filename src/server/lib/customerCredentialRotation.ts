import { createClient } from '@supabase/supabase-js';
import { getSecret } from '#runtime/secrets';
import { isDatabaseConfigured } from '../db/db.js';
import { deleteAllCustomerSessions } from './customerSessionStore.js';
import { updateUser } from './userStore.js';

export interface CustomerCredentialRotationResult {
  credentialVersion: number;
  revokedSessions: number;
}

function getSupabaseAdminConfig(): { url: string; key: string } | null {
  const url = String(getSecret('SUPABASE_URL') || '').trim();
  const key = String(
    getSecret('SUPABASE_SERVICE_ROLE_KEY') ||
    getSecret('SUPABASE_SECRET_KEY') ||
    '',
  ).trim();
  return url && key ? { url, key } : null;
}

/**
 * Rotate a customer credential through the database's approved service-role
 * boundary. The users table trigger rejects direct password_hash changes from
 * the PostgreSQL application connection, while Supabase service_role requests
 * are explicitly permitted and remain server-side.
 */
export async function rotateCustomerPasswordCredential(input: {
  userId: string;
  passwordHash: string;
  expectedCredentialVersion: number;
}): Promise<CustomerCredentialRotationResult> {
  const nextCredentialVersion = input.expectedCredentialVersion + 1;

  if (!isDatabaseConfigured()) {
    const updated = await updateUser(input.userId, {
      passwordHash: input.passwordHash,
      credentialVersion: nextCredentialVersion,
      loginAttempts: 0,
    });
    if (!updated) throw new Error('Customer credential rotation target was not found.');
    const revokedSessions = await deleteAllCustomerSessions(input.userId);
    return { credentialVersion: nextCredentialVersion, revokedSessions };
  }

  const config = getSupabaseAdminConfig();
  if (!config) {
    throw new Error('Customer credential rotation is not configured.');
  }

  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client
    .from('users')
    .update({
      password_hash: input.passwordHash,
      credential_version: nextCredentialVersion,
      login_attempts: 0,
    })
    .eq('id', input.userId)
    .eq('credential_version', input.expectedCredentialVersion)
    .select('id, credential_version')
    .maybeSingle();

  if (error) {
    const safeCode = typeof error.code === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(error.code)
      ? error.code
      : 'SUPABASE_WRITE_FAILED';
    throw Object.assign(new Error('Customer credential rotation failed.'), { code: safeCode });
  }
  if (!data) {
    throw Object.assign(new Error('Customer credential changed concurrently.'), { code: 'CREDENTIAL_VERSION_CONFLICT' });
  }

  const revokedSessions = await deleteAllCustomerSessions(input.userId);
  return { credentialVersion: nextCredentialVersion, revokedSessions };
}
