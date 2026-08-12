import crypto from 'node:crypto';
import path from 'node:path';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { appendCriticalAudit } from './auditLog.js';
import { createOperationalBackup } from './operationalBackup.js';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/;
const SYNTHETIC_EMAIL = /^[^@\s]+@example\.test$/i;
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,199}$/;

interface CandidateRow {
  id: string;
  source: string;
  reference_id: string;
  requester_email: string | null;
  user_id: string | null;
  status: string;
}

export interface OperationsQuarantineCandidate {
  id: string;
  source: string;
  referenceId: string;
  emailHash: string;
  status: string;
}

export interface OperationsQuarantinePreview {
  confirmationSha256: string;
  requestedCount: number;
  foundCount: number;
  missingIds: string[];
  candidates: OperationsQuarantineCandidate[];
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalSnapshot(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}

function assertReference(value: string, label: string): string {
  const normalized = value.trim();
  if (!SAFE_REFERENCE.test(normalized)) throw new Error(`${label} is missing or invalid.`);
  return normalized;
}

export function normalizeOperationsQuarantineIds(input: string[]): string[] {
  const ids = [...new Set(input.map(value => value.trim()).filter(Boolean))].sort();
  if (!ids.length) throw new Error('At least one exact Operations Inbox ID is required.');
  if (ids.some(id => !SAFE_ID.test(id))) throw new Error('Every Operations Inbox ID must be an exact safe identifier.');
  return ids;
}

export function operationsQuarantineConfirmationSha256(ids: string[]): string {
  return sha256(normalizeOperationsQuarantineIds(ids).join('\n'));
}

export function assertSyntheticOperationsCandidate(row: Pick<CandidateRow, 'requester_email'|'user_id'|'status'>): void {
  if (!row.requester_email || !SYNTHETIC_EMAIL.test(row.requester_email)) {
    throw new Error('Operations quarantine accepts only records using an exact @example.test address.');
  }
  if (row.user_id) throw new Error('Operations records linked to a customer identity require manual review.');
  if (row.status === 'archived') throw new Error('One or more Operations records are already archived.');
}

export async function previewOperationsQuarantine(inputIds: string[]): Promise<OperationsQuarantinePreview> {
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is required.');
  const ids = normalizeOperationsQuarantineIds(inputIds);
  const sql = getQueryClient();
  const rows = await sql<CandidateRow[]>`
    SELECT id, source, reference_id, requester_email, user_id, status
    FROM operations_items
    WHERE id IN ${sql(ids)}
    ORDER BY id
  `;
  rows.forEach(assertSyntheticOperationsCandidate);
  const found = new Set(rows.map(row => row.id));
  return {
    confirmationSha256: sha256(ids.join('\n')),
    requestedCount: ids.length,
    foundCount: rows.length,
    missingIds: ids.filter(id => !found.has(id)),
    candidates: rows.map(row => ({
      id: row.id,
      source: row.source,
      referenceId: row.reference_id,
      emailHash: sha256(row.requester_email!.toLowerCase()),
      status: row.status,
    })),
  };
}

export async function quarantineOperationsItems(options: {
  ids: string[];
  confirmationSha256: string;
  expectedItemCount: number;
  reason: string;
  actor: string;
}): Promise<{ batchId: string; itemCount: number; backupFilename: string; backupSha256: string }> {
  const ids = normalizeOperationsQuarantineIds(options.ids);
  const expectedConfirmation = sha256(ids.join('\n'));
  if (!/^[0-9a-f]{64}$/i.test(options.confirmationSha256) ||
      !crypto.timingSafeEqual(Buffer.from(expectedConfirmation), Buffer.from(options.confirmationSha256.toLowerCase()))) {
    throw new Error('Quarantine confirmation hash does not match the exact Operations Inbox ID list.');
  }
  if (!Number.isInteger(options.expectedItemCount) || options.expectedItemCount !== ids.length) {
    throw new Error('Expected item count must exactly match the approved ID list.');
  }
  const actor = options.actor.trim();
  const reason = options.reason.trim();
  if (actor.length < 3 || actor.length > 200) throw new Error('A valid quarantine actor is required.');
  if (reason.length < 10 || reason.length > 1000) throw new Error('Quarantine reason must contain 10-1000 characters.');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is required.');

  await appendCriticalAudit({
    event: 'operations_test_records_quarantine_intent', adminId: actor, email: actor, reason,
    meta: { itemIds: ids, confirmationSha256: expectedConfirmation },
  });
  const backup = await createOperationalBackup();
  const backupFilename = path.basename(backup.file);
  const sql = getQueryClient();
  const batchId = `oqb_${crypto.randomBytes(12).toString('hex')}`;

  return sql.begin(async transaction => {
    const rows = await transaction<CandidateRow[]>`
      SELECT id, source, reference_id, requester_email, user_id, status
      FROM operations_items
      WHERE id IN ${transaction(ids)}
      ORDER BY id
      FOR UPDATE
    `;
    if (rows.length !== options.expectedItemCount) throw new Error('Candidate set changed after preview; run preview again.');
    rows.forEach(assertSyntheticOperationsCandidate);

    await transaction`
      INSERT INTO operations_quarantine_batches
        (id, backup_filename, backup_sha256, reason, initiated_by, status, item_count)
      VALUES
        (${batchId}, ${backupFilename}, ${backup.checksum}, ${reason}, ${actor}, 'planned', ${rows.length})
    `;
    const quarantinedAt = new Date().toISOString();
    for (const row of rows) {
      const previousState = { status: row.status };
      await transaction`
        INSERT INTO operations_quarantine_records
          (id, batch_id, operations_item_id, previous_state, snapshot_sha256)
        VALUES
          (${`oqr_${crypto.randomBytes(12).toString('hex')}`}, ${batchId}, ${row.id},
           ${transaction.json(previousState)}, ${sha256(canonicalSnapshot(previousState))})
      `;
      await transaction`
        UPDATE operations_items
        SET status = 'archived',
            metadata = metadata || ${transaction.json({ quarantineBatchId: batchId, quarantinedAt, dataClassification: 'synthetic_quarantined' })},
            history = history || ${transaction.json([{ at: quarantinedAt, actor, action: 'synthetic_record_quarantined', detail: batchId }])}::jsonb,
            updated_at = NOW()
        WHERE id = ${row.id}
      `;
    }
    await transaction`UPDATE operations_quarantine_batches SET status = 'applied', applied_at = NOW() WHERE id = ${batchId}`;
    await transaction`
      INSERT INTO audit_log (id, admin_id, admin_email, action, target, target_id, details, ts)
      VALUES (${`al_${crypto.randomBytes(8).toString('hex')}`}, ${actor}, ${actor},
        'operations_test_records_quarantined', 'operations_quarantine_batch', ${batchId},
        ${transaction.json({ reason, itemIds: ids, backupFilename, backupSha256: backup.checksum })}, NOW())
    `;
    return { batchId, itemCount: rows.length, backupFilename, backupSha256: backup.checksum };
  });
}

export async function restoreOperationsQuarantine(options: {
  batchId: string;
  approvalReference: string;
  actor: string;
}): Promise<{ batchId: string; itemCount: number }> {
  const batchId = assertReference(options.batchId, 'Operations quarantine batch ID');
  const approvalReference = assertReference(options.approvalReference, 'Restore approval reference');
  const actor = options.actor.trim();
  if (actor.length < 3 || actor.length > 200) throw new Error('A valid restore actor is required.');
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is required.');
  await appendCriticalAudit({
    event: 'operations_test_records_restore_intent', adminId: actor, email: actor,
    reason: approvalReference, meta: { batchId },
  });

  const sql = getQueryClient();
  return sql.begin(async transaction => {
    const batches = await transaction<Array<{ status: string }>>`
      SELECT status FROM operations_quarantine_batches WHERE id = ${batchId} FOR UPDATE
    `;
    if (batches[0]?.status !== 'applied') throw new Error('Only an applied Operations quarantine batch can be restored.');
    const records = await transaction<Array<{
      operations_item_id: string; previous_state: Record<string, unknown>; snapshot_sha256: string;
    }>>`
      SELECT operations_item_id, previous_state, snapshot_sha256
      FROM operations_quarantine_records WHERE batch_id = ${batchId} ORDER BY operations_item_id
    `;
    const restoredAt = new Date().toISOString();
    for (const record of records) {
      if (sha256(canonicalSnapshot(record.previous_state)) !== record.snapshot_sha256) {
        throw new Error(`Operations quarantine snapshot integrity check failed for ${record.operations_item_id}.`);
      }
      const updated = await transaction<Array<{ id: string }>>`
        UPDATE operations_items
        SET status = ${String(record.previous_state.status)},
            metadata = metadata || ${transaction.json({ quarantineRestoredAt: restoredAt, quarantineRestoreApprovalReference: approvalReference })},
            history = history || ${transaction.json([{ at: restoredAt, actor, action: 'synthetic_record_quarantine_restored', detail: batchId }])}::jsonb,
            updated_at = NOW()
        WHERE id = ${record.operations_item_id}
          AND status = 'archived'
          AND metadata->>'quarantineBatchId' = ${batchId}
        RETURNING id
      `;
      if (updated.length !== 1) throw new Error(`Operations record ${record.operations_item_id} no longer matches the quarantine batch.`);
    }
    await transaction`
      UPDATE operations_quarantine_batches
      SET status = 'restored', restored_at = NOW(), restore_approval_reference = ${approvalReference}
      WHERE id = ${batchId}
    `;
    await transaction`
      INSERT INTO audit_log (id, admin_id, admin_email, action, target, target_id, details, ts)
      VALUES (${`al_${crypto.randomBytes(8).toString('hex')}`}, ${actor}, ${actor},
        'operations_test_records_restored', 'operations_quarantine_batch', ${batchId},
        ${transaction.json({ approvalReference, itemCount: records.length })}, NOW())
    `;
    return { batchId, itemCount: records.length };
  });
}
