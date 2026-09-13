import 'dotenv/config';
import { hashPassword } from '../src/server/lib/passwordHash.js';
import { getDb, closeConnection } from '../src/server/db/db.js';
import { admins, adminSessions, auditLog } from '../src/server/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

/**
 * Set the password for the admin@citygate.capital row (must already exist).
 *
 * The password is never hardcoded: it comes from the CGC_ADMIN_NEW_PASSWORD
 * environment variable, or (when stdin is a TTY) from a hidden interactive
 * prompt. Prefer `npm run admin:rotate-password`, which additionally
 * bootstraps the first SUPER_ADMIN when no admin row exists.
 */

async function promptHidden(message) {
  if (!process.stdin.isTTY) return null;
  return new Promise(resolve => {
    process.stdout.write(message);
    let value = '';
    const onData = ch => {
      const c = ch.toString('utf8');
      if (c === '\r' || c === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (c === '') process.exit(1); // Ctrl+C
      if (c === '' || c === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += c;
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function main() {
  const email = 'admin@citygate.capital';
  const newPassword = (process.env.CGC_ADMIN_NEW_PASSWORD ?? '').trim()
    || await promptHidden(`New password for ${email} (input hidden, min 12 chars): `);

  if (!newPassword || newPassword.length < 12) {
    console.error('No password supplied (set CGC_ADMIN_NEW_PASSWORD or run interactively); minimum 12 characters.');
    process.exit(1);
  }

  console.log(`Setting new password for ${email}...`);

  try {
    const db = getDb();
    const passwordHash = await hashPassword(newPassword);

    const [admin] = await db.select().from(admins).where(eq(admins.email, email));

    if (!admin) {
      console.error('Admin user not found. Use `npm run admin:rotate-password` to bootstrap the first SUPER_ADMIN.');
      process.exit(1);
    }

    await db.transaction(async tx => {
      // 1. Update password
      await tx.update(admins)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(admins.id, admin.id));

      // 2. Revoke sessions
      await tx.delete(adminSessions).where(eq(adminSessions.adminId, admin.id));

      // 3. Audit log (no secret values)
      await tx.insert(auditLog).values({
        id: `al_${crypto.randomBytes(8).toString('hex')}`,
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'ADMIN_PASSWORD_RESET',
        target: 'admin',
        targetId: admin.id,
        details: { method: 'set-admin-password-script', success: true },
        ip: '127.0.0.1',
        ts: new Date(),
      });
    });

    console.log('Password successfully updated (value not echoed). All admin sessions were revoked.');
  } catch (err) {
    console.error('Error updating password:', err);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();