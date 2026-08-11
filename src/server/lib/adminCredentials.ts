/**
 * Secure administrator credential store.
 *
 * The password hash is loaded from the ADMIN_PASSWORD_HASH environment secret.
 * Hashes are resolved at request time via env — never at module-load time.
 *
 * New hashes use Argon2id. Legacy bcrypt/PBKDF2 hashes remain verifiable so
 * existing installations can migrate without an emergency password reset.
 */

import { getSecret } from '#runtime/secrets';
import {
  hashPassword as hashSecurePassword,
  verifyPassword as verifySecurePassword,
} from './passwordHash.js';

export interface AdminRecord {
  id:           string;
  email:        string;
  name:         string;
  role:         string;
  avatar:       string;
  passwordHash: string;
}

const ADMIN_STATIC: Omit<AdminRecord, 'passwordHash'>[] = [
  {
    id:     'admin_001',
    email:  'admin@citygate.capital',
    name:   'Super Admin',
    role:   'superadmin',
    avatar: 'SA',
  },
];

function isSupportedHash(value: string): boolean {
  return value.startsWith('$argon2') || value.startsWith('$2a$') ||
    value.startsWith('$2b$') || value.startsWith('$2y$') || value.startsWith('100000:');
}

/** Resolve hash from env secrets at request time (V2 takes precedence). */
function resolveHash(): string {
  const v2 = String(getSecret('ADMIN_PASSWORD_HASH_V2') ?? process.env.ADMIN_PASSWORD_HASH_V2 ?? '');
  if (isSupportedHash(v2)) return v2;
  const primary = String(getSecret('ADMIN_PASSWORD_HASH') ?? process.env.ADMIN_PASSWORD_HASH ?? '');
  if (isSupportedHash(primary)) return primary;
  return '';
}

export function getAdminUsers(): AdminRecord[] {
  const secretHash = resolveHash();
  return ADMIN_STATIC.map(u => ({
    ...u,
    passwordHash: secretHash,
  }));
}

export function findAdminByEmail(email: string): AdminRecord | undefined {
  return getAdminUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

/** Create new administrator hashes using the platform's Argon2id policy. */
export async function hashPassword(password: string): Promise<string> {
  return hashSecurePassword(password);
}

/** Verify current Argon2id hashes and supported legacy bcrypt/PBKDF2 hashes. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  return (await verifySecurePassword(plain, stored)).ok;
}
