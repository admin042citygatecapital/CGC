/**
 * Secure administrator credential store.
 *
 * Production credentials are loaded from PostgreSQL. An environment-backed
 * identity is retained only for database-free local development.
 *
 * New hashes use Argon2id. Legacy bcrypt/PBKDF2 hashes remain verifiable so
 * existing installations can migrate without an emergency password reset.
 */

import { getSecret } from '#runtime/secrets';
import {
  hashPassword as hashSecurePassword,
  verifyPassword as verifySecurePassword,
} from './passwordHash.js';
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { admins } from '../db/schema.js';
import { isAdminRole, type AdminRole } from './sessionStore.js';
import { isProd } from './envConfig.js';

export interface AdminRecord {
  id:           string;
  email:        string;
  name:         string;
  role:         AdminRole;
  avatar:       string;
  passwordHash: string;
}

const ADMIN_STATIC: Omit<AdminRecord, 'passwordHash'>[] = [
  {
    id:     'admin_001',
    email:  'admin@citygate.capital',
    name:   'Super Admin',
    role:   'SUPER_ADMIN',
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

export async function findAdminByEmail(email: string): Promise<AdminRecord | undefined> {
  const normalizedEmail = email.trim().toLowerCase();
  if (isDatabaseConfigured()) {
    const row = (await getDb().select().from(admins).where(eq(admins.email, normalizedEmail)).limit(1))[0];
    if (row?.isActive && isAdminRole(row.role)) {
      const initials = row.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
      return { id: row.id, email: row.email, name: row.name, role: row.role, avatar: initials || 'A', passwordHash: row.passwordHash };
    }
    // A configured database is the production source of truth. Do not fall
    // through to an environment-backed identity when a row is absent,
    // inactive, suspended, or has an invalid role.
    return undefined;
  }
  if (isProd) return undefined;
  return getAdminUsers().find(user => user.email.toLowerCase() === normalizedEmail);
}

/** Create new administrator hashes using the platform's Argon2id policy. */
export async function hashPassword(password: string): Promise<string> {
  return hashSecurePassword(password);
}

/** Verify current Argon2id hashes and supported legacy bcrypt/PBKDF2 hashes. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  return (await verifySecurePassword(plain, stored)).ok;
}
