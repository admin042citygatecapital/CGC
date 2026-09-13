/**
 * Interactive, database-backed SUPER_ADMIN password rotation.
 *
 * The password and generated hash are never printed. Run this only from a
 * protected terminal with DATABASE_URL configured:
 *
 *   npm run admin:rotate-password
 *
 * Non-interactive environments (e.g. a Render one-shot job with no TTY) may
 * instead supply CGC_ADMIN_NEW_PASSWORD: the variable is consumed once,
 * policy-validated, and removed from the environment before the rotation
 * begins. It is never echoed or logged.
 */

import crypto from 'node:crypto';
import process from 'node:process';
import postgres from 'postgres';

import { validateAdminPassword } from '../src/server/lib/adminPasswordPolicy.js';
import { hashPassword, verifyPassword } from '../src/server/lib/passwordHash.js';

const ADMIN_ID = 'admin_001';
const ADMIN_EMAIL = 'admin@citygate.capital';
const ADMIN_NAME = 'Super Admin';
const ADMIN_ROLE = 'SUPER_ADMIN';

class RotationError extends Error {}

async function readHidden(prompt: string): Promise<{ value: string; bytes: Buffer }> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new RotationError('A protected interactive terminal is required.');
  }

  process.stdout.write(prompt);
  const bytes: number[] = [];
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };

    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) {
          cleanup();
          reject(new RotationError('Password rotation cancelled.'));
          return;
        }
        if (byte === 13 || byte === 10) {
          cleanup();
          const buffer = Buffer.from(bytes);
          resolve({ value: buffer.toString('utf8'), bytes: buffer });
          return;
        }
        if (byte === 8 || byte === 127) {
          bytes.pop();
          continue;
        }
        if (byte >= 32) bytes.push(byte);
      }
    };

    process.stdin.on('data', onData);
  });
}

function assertDatabaseUrl(): string {
  const value = String(process.env.DATABASE_URL ?? '').trim();
  if (!value.startsWith('postgres://') && !value.startsWith('postgresql://')) {
    throw new RotationError('DATABASE_URL must reference PostgreSQL.');
  }
  return value;
}

async function run(): Promise<void> {
  let password = '';
  let confirmation = '';
  let generatedHash = '';
  let passwordBytes: Buffer | undefined;
  let confirmationBytes: Buffer | undefined;
  let sql: ReturnType<typeof postgres> | undefined;
  const operationId = crypto.randomUUID();

  try {
    const envPassword = String(process.env.CGC_ADMIN_NEW_PASSWORD ?? '').trim();
    if (envPassword) {
      // Non-interactive path: no confirmation prompt exists, so the policy
      // check below is the only guard. Delete the variable immediately so it
      // does not outlive this read in the process environment.
      delete process.env.CGC_ADMIN_NEW_PASSWORD;
      process.stdout.write('Using CGC_ADMIN_NEW_PASSWORD from the environment (value not echoed).\n');
      password = envPassword;
      passwordBytes = Buffer.from(envPassword, 'utf8');
    } else {
      const first = await readHidden('New SUPER_ADMIN password: ');
      password = first.value;
      passwordBytes = first.bytes;
      const second = await readHidden('Confirm new password: ');
      confirmation = second.value;
      confirmationBytes = second.bytes;

      if (password !== confirmation) throw new RotationError('The password entries do not match.');
    }
    const policy = validateAdminPassword(password);
    if (!policy.ok) throw new RotationError(policy.errors.join(' '));

    generatedHash = await hashPassword(password);
    if (!generatedHash.startsWith('$argon2id$')) throw new RotationError('Canonical Argon2id hashing failed.');
    if (!(await verifyPassword(password, generatedHash)).ok) throw new RotationError('Generated hash verification failed.');
    if ((await verifyPassword(`${password}\u0000incorrect`, generatedHash)).ok) {
      throw new RotationError('Incorrect-password verification did not fail safely.');
    }
    if ((await verifyPassword(password, '$argon2id$malformed')).ok) {
      throw new RotationError('Malformed-hash verification did not fail safely.');
    }

    sql = postgres(assertDatabaseUrl(), { max: 1, prepare: false, connect_timeout: 15 });
    await sql.begin(async transaction => {
      const tableState = await transaction<{ admins: string | null; sessions: string | null; audit: string | null }[]>`
        SELECT
          to_regclass('public.admins')::text AS admins,
          to_regclass('public.admin_sessions')::text AS sessions,
          to_regclass('public.audit_log')::text AS audit
      `;
      if (!tableState[0]?.admins || !tableState[0]?.sessions || !tableState[0]?.audit) {
        throw new RotationError('Required admin authentication tables are not installed. Apply migration 0046 after verifying the base schema.');
      }

      const matching = await transaction<{ id: string; email: string; role: string; is_active: boolean }[]>`
        SELECT id, email, role::text AS role, is_active
        FROM admins
        WHERE LOWER(email) = LOWER(${ADMIN_EMAIL})
        FOR UPDATE
      `;
      const superAdmins = await transaction<{ id: string; email: string }[]>`
        SELECT id, email FROM admins WHERE role = 'SUPER_ADMIN'::admin_role FOR UPDATE
      `;

      let record = matching[0];
      if (!record) {
        if (superAdmins.length > 0) {
          throw new RotationError('A different SUPER_ADMIN already exists; refusing to create a duplicate.');
        }
        const inserted = await transaction<{ id: string; email: string; role: string; is_active: boolean }[]>`
          INSERT INTO admins (id, email, password_hash, name, role, is_active, must_change_password, created_at, updated_at)
          VALUES (${ADMIN_ID}, ${ADMIN_EMAIL}, ${generatedHash}, ${ADMIN_NAME}, 'SUPER_ADMIN'::admin_role, TRUE, FALSE, NOW(), NOW())
          RETURNING id, email, role::text AS role, is_active
        `;
        record = inserted[0];
      } else {
        if (record.id !== ADMIN_ID || record.role !== ADMIN_ROLE || !record.is_active) {
          throw new RotationError('The canonical administrator identity is not an active SUPER_ADMIN; refusing an unsafe rotation.');
        }
        await transaction`
          UPDATE admins
          SET password_hash = ${generatedHash}, updated_at = NOW()
          WHERE id = ${record.id}
        `;
      }

      const revoked = await transaction<{ count: number }[]>`
        WITH revoked_sessions AS (
          DELETE FROM admin_sessions WHERE admin_id = ${record.id} RETURNING 1
        )
        SELECT COUNT(*)::int AS count FROM revoked_sessions
      `;
      const revokedCount = revoked[0]?.count ?? 0;
      await transaction`
        INSERT INTO audit_log (id, admin_id, admin_email, action, target, target_id, details, ip, ts)
        VALUES (
          ${`al_${crypto.randomBytes(8).toString('hex')}`},
          ${record.id},
          ${record.email},
          'ADMIN_PASSWORD_ROTATED',
          'admin',
          ${record.id},
          ${transaction.json({ role: record.role, operationId, success: true, sessionsRevoked: revokedCount })},
          NULL,
          NOW()
        )
      `;

      process.stdout.write(`Password rotation complete for ${record.id} (${record.role}).\n`);
      process.stdout.write(`Existing sessions revoked: ${revokedCount}. Operation: ${operationId}.\n`);
    });
  } catch (error) {
    const safeMessage = error instanceof RotationError
      ? error.message
      : 'The protected database operation failed. Review server-side diagnostics without exposing credentials.';
    process.stderr.write(`Password rotation failed: ${safeMessage}\n`);
    process.exitCode = 1;
  } finally {
    passwordBytes?.fill(0);
    confirmationBytes?.fill(0);
    password = '';
    confirmation = '';
    generatedHash = '';
    if (sql) await sql.end({ timeout: 5 });
  }
}

await run();
