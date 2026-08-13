import crypto from 'node:crypto';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';

// Only IANA/special-use non-public domains are accepted. `.local` is included
// for the legacy City Gate preview identity; arbitrary production domains are
// intentionally rejected even when an operator claims they are test data.
const TEST_EMAIL = /^[^@\s]+@(example\.(com|net|org)|[^@\s]+\.(test|invalid|local)|localhost)$/i;
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,199}$/;

export interface QuarantineCandidate {
  id: string;
  emailHash: string;
  status: string;
  dataClassification: string;
  transactionCount: number;
}

export interface QuarantinePreview {
  confirmationSha256: string;
  requestedCount: number;
  foundCount: number;
  missingEmailHashes: string[];
  candidates: QuarantineCandidate[];
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalSnapshot(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}

function jsonb(value: unknown): string {
  return JSON.stringify(value);
}

export function normalizeTestEmails(input: string[]): string[] {
  const emails = [...new Set(input.map(value => value.trim().toLowerCase()).filter(Boolean))].sort();
  if (!emails.length) throw new Error('At least one exact test-customer email is required.');
  const unsafe = emails.filter(email => !TEST_EMAIL.test(email));
  if (unsafe.length) {
    throw new Error('Quarantine accepts only exact addresses on reserved test domains; review all other identities manually.');
  }
  return emails;
}

export function quarantineConfirmationSha256(emails: string[]): string {
  return sha256(normalizeTestEmails(emails).join('\n'));
}

function assertReference(value: string, label: string): string {
  const normalized = value.trim();
  if (!SAFE_REFERENCE.test(normalized)) throw new Error(`${label} is missing or invalid.`);
  return normalized;
}

export async function previewTestDataQuarantine(inputEmails: string[]): Promise<QuarantinePreview> {
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is required.');
  const emails = normalizeTestEmails(inputEmails);
  const sql = getQueryClient();
  const rows = await sql<Array<{
    id: string; email: string; status: string; data_classification: string; transaction_count: number;
  }>>`
    SELECT u.id, lower(u.email) AS email, u.status,
           u.data_classification,
           COUNT(t.id)::int AS transaction_count
    FROM users u
    LEFT JOIN transactions t ON t.user_id = u.id
    WHERE lower(u.email) IN ${sql(emails)}
    GROUP BY u.id, u.email, u.status, u.data_classification
    ORDER BY lower(u.email)
  `;
  const found = new Set(rows.map(row => row.email));
  return {
    confirmationSha256: sha256(emails.join('\n')),
    requestedCount: emails.length,
    foundCount: rows.length,
    missingEmailHashes: emails.filter(email => !found.has(email)).map(sha256),
    candidates: rows.map(row => ({
      id: row.id,
      emailHash: sha256(row.email),
      status: row.status,
      dataClassification: row.data_classification,
      transactionCount: row.transaction_count,
    })),
  };
}

export async function quarantineTestData(options: {
  emails: string[];
  confirmationSha256: string;
  providerBackupReference: string;
  providerBackupVerifiedAt: string;
  expectedCustomerCount: number;
  expectedTransactionCount: number;
  reason: string;
  actor: string;
}): Promise<{ batchId: string; customerCount: number; transactionCount: number; revokedSessions: number }> {
  const emails = normalizeTestEmails(options.emails);
  const expectedConfirmation = sha256(emails.join('\n'));
  if (!/^[0-9a-f]{64}$/i.test(options.confirmationSha256) ||
      !crypto.timingSafeEqual(Buffer.from(expectedConfirmation), Buffer.from(options.confirmationSha256.toLowerCase()))) {
    throw new Error('Quarantine confirmation hash does not match the exact candidate list.');
  }
  const providerBackupReference = assertReference(options.providerBackupReference, 'Provider backup reference');
  const providerBackupVerifiedAt = new Date(options.providerBackupVerifiedAt);
  const backupAgeMs = Date.now() - providerBackupVerifiedAt.getTime();
  if (!Number.isFinite(providerBackupVerifiedAt.getTime()) || backupAgeMs < -5 * 60_000 || backupAgeMs > 72 * 60 * 60_000) {
    throw new Error('Provider backup verification must be a valid timestamp from the last 72 hours.');
  }
  if (!Number.isInteger(options.expectedCustomerCount) || options.expectedCustomerCount < 1 || options.expectedCustomerCount !== emails.length) {
    throw new Error('Expected customer count must exactly match the approved email list.');
  }
  if (!Number.isInteger(options.expectedTransactionCount) || options.expectedTransactionCount < 0) {
    throw new Error('Expected transaction count must be a non-negative integer.');
  }
  const actor = options.actor.trim();
  const reason = options.reason.trim();
  if (actor.length < 3 || actor.length > 200) throw new Error('A valid quarantine actor is required.');
  if (reason.length < 10 || reason.length > 1000) throw new Error('Quarantine reason must contain 10-1000 characters.');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is required.');

  const sql = getQueryClient();
  const batchId = `dqb_${crypto.randomBytes(12).toString('hex')}`;
  return sql.begin(async transaction => {
    const candidates = await transaction<Array<{
      id: string; email: string; status: string; data_classification: string;
      quarantine_batch_id: string | null; quarantined_at: Date | null;
    }>>`
      SELECT id, lower(email) AS email, status, data_classification,
             quarantine_batch_id, quarantined_at
      FROM users
      WHERE lower(email) IN ${transaction(emails)}
      ORDER BY lower(email)
      FOR UPDATE
    `;
    if (candidates.length !== options.expectedCustomerCount) throw new Error('Candidate set changed after preview; run preview again.');
    if (candidates.some(row => row.quarantine_batch_id || row.data_classification === 'quarantined_test')) {
      throw new Error('One or more candidates are already quarantined.');
    }
    const userIds = candidates.map(row => row.id);
    const transactionRows = await transaction<Array<{
      id: string; data_classification: string; quarantine_batch_id: string | null;
    }>>`
      SELECT id, data_classification, quarantine_batch_id
      FROM transactions
      WHERE user_id IN ${transaction(userIds)}
      ORDER BY id
      FOR UPDATE
    `;
    if (transactionRows.length !== options.expectedTransactionCount) {
      throw new Error('Linked transaction set changed after preview; run preview again.');
    }

    await transaction`
      INSERT INTO data_quarantine_batches
        (id, provider_backup_reference, provider_backup_verified_at, reason, initiated_by, status, customer_count, transaction_count)
      VALUES
        (${batchId}, ${providerBackupReference}, ${providerBackupVerifiedAt}, ${reason}, ${actor}, 'planned', ${candidates.length}, ${transactionRows.length})
    `;

    for (const row of candidates) {
      const previousState = {
        status: row.status,
        dataClassification: row.data_classification,
        quarantineBatchId: row.quarantine_batch_id,
        quarantinedAt: row.quarantined_at?.toISOString() ?? null,
      };
      const canonical = canonicalSnapshot(previousState);
      await transaction`
        INSERT INTO data_quarantine_records
          (id, batch_id, resource_type, resource_id, previous_state, snapshot_sha256)
        VALUES
          (${`dqr_${crypto.randomBytes(12).toString('hex')}`}, ${batchId}, 'user', ${row.id},
           ${jsonb(previousState)}::jsonb, ${sha256(canonical)})
      `;
    }
    for (const row of transactionRows) {
      const previousState = {
        dataClassification: row.data_classification,
        quarantineBatchId: row.quarantine_batch_id,
      };
      const canonical = canonicalSnapshot(previousState);
      await transaction`
        INSERT INTO data_quarantine_records
          (id, batch_id, resource_type, resource_id, previous_state, snapshot_sha256)
        VALUES
          (${`dqr_${crypto.randomBytes(12).toString('hex')}`}, ${batchId}, 'transaction', ${row.id},
           ${jsonb(previousState)}::jsonb, ${sha256(canonical)})
      `;
    }

    const revoked = await transaction<Array<{ user_id: string }>>`
      DELETE FROM customer_sessions
      WHERE user_id IN ${transaction(userIds)}
      RETURNING user_id
    `;
    await transaction`
      UPDATE transactions
      SET data_classification = 'synthetic_quarantined', quarantine_batch_id = ${batchId}
      WHERE user_id IN ${transaction(userIds)}
    `;
    await transaction`
      UPDATE users
      SET status = 'suspended', data_classification = 'quarantined_test',
          quarantine_batch_id = ${batchId}, quarantined_at = NOW(), updated_at = NOW()
      WHERE id IN ${transaction(userIds)}
    `;
    await transaction`
      UPDATE data_quarantine_batches SET status = 'applied', applied_at = NOW() WHERE id = ${batchId}
    `;
    await transaction`
      INSERT INTO audit_log
        (id, admin_id, admin_email, action, target, target_id, details, ts)
      VALUES
        (${`al_${crypto.randomBytes(8).toString('hex')}`}, ${actor}, ${actor}, 'production_test_data_quarantined',
         'data_quarantine_batch', ${batchId},
         ${jsonb({ providerBackupReference, providerBackupVerifiedAt: providerBackupVerifiedAt.toISOString(), reason, customerCount: candidates.length, transactionCount: transactionRows.length, candidateEmailHashes: candidates.map(row => sha256(row.email)) })}::jsonb, NOW())
    `;
    return { batchId, customerCount: candidates.length, transactionCount: transactionRows.length, revokedSessions: revoked.length };
  });
}

export async function restoreQuarantineBatch(options: {
  batchId: string; approvalReference: string; actor: string;
}): Promise<{ batchId: string; customerCount: number; transactionCount: number }> {
  const batchId = assertReference(options.batchId, 'Quarantine batch ID');
  const approvalReference = assertReference(options.approvalReference, 'Restore approval reference');
  const actor = options.actor.trim();
  if (actor.length < 3 || actor.length > 200) throw new Error('A valid restore actor is required.');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is required.');
  const sql = getQueryClient();
  return sql.begin(async transaction => {
    const batches = await transaction<Array<{ status: string }>>`
      SELECT status FROM data_quarantine_batches WHERE id = ${batchId} FOR UPDATE
    `;
    if (batches[0]?.status !== 'applied') throw new Error('Only an applied quarantine batch can be restored.');
    const records = await transaction<Array<{
      resource_type: 'user'|'transaction'; resource_id: string; previous_state: Record<string, unknown>; snapshot_sha256: string;
    }>>`
      SELECT resource_type, resource_id, previous_state, snapshot_sha256
      FROM data_quarantine_records WHERE batch_id = ${batchId} ORDER BY resource_type, resource_id
    `;
    let customerCount = 0;
    let transactionCount = 0;
    for (const record of records) {
      const state = record.previous_state;
      if (sha256(canonicalSnapshot(state)) !== record.snapshot_sha256) {
        throw new Error(`Quarantine snapshot integrity check failed for ${record.resource_type} ${record.resource_id}.`);
      }
      if (record.resource_type === 'user') {
        customerCount += 1;
        await transaction`
          UPDATE users SET
            status = ${String(state.status)},
            data_classification = ${String(state.dataClassification)},
            quarantine_batch_id = ${state.quarantineBatchId ? String(state.quarantineBatchId) : null},
            quarantined_at = ${state.quarantinedAt ? new Date(String(state.quarantinedAt)) : null},
            updated_at = NOW()
          WHERE id = ${record.resource_id} AND quarantine_batch_id = ${batchId}
        `;
      } else {
        transactionCount += 1;
        await transaction`
          UPDATE transactions SET
            data_classification = ${String(state.dataClassification)},
            quarantine_batch_id = ${state.quarantineBatchId ? String(state.quarantineBatchId) : null}
          WHERE id = ${record.resource_id} AND quarantine_batch_id = ${batchId}
        `;
      }
    }
    await transaction`
      UPDATE data_quarantine_batches SET status = 'restored', restored_at = NOW(),
        restore_approval_reference = ${approvalReference} WHERE id = ${batchId}
    `;
    await transaction`
      INSERT INTO audit_log
        (id, admin_id, admin_email, action, target, target_id, details, ts)
      VALUES
        (${`al_${crypto.randomBytes(8).toString('hex')}`}, ${actor}, ${actor}, 'production_test_data_restored',
         'data_quarantine_batch', ${batchId},
         ${jsonb({ approvalReference, customerCount, transactionCount })}::jsonb, NOW())
    `;
    return { batchId, customerCount, transactionCount };
  });
}
