/** Single-use customer password-recovery token storage. */

import crypto from 'node:crypto';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';

interface MemoryToken {
  userId: string;
  expiresAt: number;
  consumed: boolean;
}

const memory = new Map<string, MemoryToken>();

function digest(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function issueCustomerResetToken(
  userId: string,
  rawToken: string,
  expiresAt: Date,
): Promise<void> {
  const tokenHash = digest(rawToken);
  if (!isDatabaseConfigured()) {
    for (const [key, value] of memory.entries()) {
      if (value.userId === userId) memory.delete(key);
    }
    memory.set(tokenHash, { userId, expiresAt: expiresAt.getTime(), consumed: false });
    return;
  }

  const sql = getQueryClient();
  await sql.begin(async (transaction) => {
    await transaction`DELETE FROM customer_password_reset_tokens WHERE user_id = ${userId}`;
    await transaction`
      INSERT INTO customer_password_reset_tokens (token_hash, user_id, expires_at)
      VALUES (${tokenHash}, ${userId}, ${expiresAt})
    `;
  });
}

export async function revokeCustomerResetToken(rawToken: string): Promise<void> {
  const tokenHash = digest(rawToken);
  if (!isDatabaseConfigured()) {
    memory.delete(tokenHash);
    return;
  }
  const sql = getQueryClient();
  await sql`DELETE FROM customer_password_reset_tokens WHERE token_hash = ${tokenHash}`;
}

/**
 * Atomically consume a valid recovery token. A concurrent or repeated request
 * receives no user identifier and therefore cannot change a credential twice.
 */
export async function consumeCustomerResetToken(rawToken: string): Promise<string | null> {
  const tokenHash = digest(rawToken);
  if (!isDatabaseConfigured()) {
    const record = memory.get(tokenHash);
    if (!record || record.consumed || record.expiresAt <= Date.now()) return null;
    record.consumed = true;
    return record.userId;
  }
  const sql = getQueryClient();
  const rows = await sql<{ user_id: string }[]>`
    UPDATE customer_password_reset_tokens
       SET consumed_at = NOW()
     WHERE token_hash = ${tokenHash}
       AND consumed_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id
  `;
  return rows[0]?.user_id ?? null;
}

export function resetCustomerResetTokensForTests(): void {
  if (isDatabaseConfigured()) throw new Error('Memory reset tokens are unavailable while DATABASE_URL is configured.');
  memory.clear();
}
