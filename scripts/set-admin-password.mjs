import 'dotenv/config';
import { hashPassword } from '../src/server/lib/passwordHash.js';
import { getDb, closeConnection } from '../src/server/db/db.js';
import { admins, adminSessions, auditLog } from '../src/server/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

async function main() {
  const email = 'admin@citygate.capital';
  const newPassword = 'CGC-Admin-Secure-2026-Pass!'; // Temporary strong password

  console.log(`Setting new password for ${email}...`);

  try {
    const db = getDb();
    const passwordHash = await hashPassword(newPassword);

    const [admin] = await db.select().from(admins).where(eq(admins.email, email));

    if (!admin) {
      console.error('Admin user not found.');
      process.exit(1);
    }

    await db.transaction(async (tx) => {
      // 1. Update password
      await tx.update(admins)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(admins.id, admin.id));

      // 2. Revoke sessions
      await tx.delete(adminSessions).where(eq(adminSessions.adminId, admin.id));

      // 3. Audit log
      await tx.insert(auditLog).values({
        id: `al_${crypto.randomBytes(8).toString('hex')}`,
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'ADMIN_PASSWORD_RESET_BY_CLAUDE',
        target: 'admin',
        targetId: admin.id,
        details: { method: 'automation_script', success: true },
        ip: '127.0.0.1',
        ts: new Date(),
      });
    });

    console.log('Password successfully updated.');
    console.log(`Admin Email: ${email}`);
    console.log(`New Password: ${newPassword}`);
    console.log('\nPlease save this password securely and rotate it immediately after login.');

  } catch (err) {
    console.error('Error updating password:', err);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
