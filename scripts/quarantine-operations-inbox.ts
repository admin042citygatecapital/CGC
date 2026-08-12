import { closeConnection } from '../src/server/db/db.js';
import {
  previewOperationsQuarantine,
  quarantineOperationsItems,
  restoreOperationsQuarantine,
} from '../src/server/lib/operationsInboxQuarantine.js';

function ids(): string[] {
  return String(process.env.OPERATIONS_QUARANTINE_IDS ?? '').split(',');
}

async function run() {
  const restoreArg = process.argv.find(value => value.startsWith('--restore='));
  if (restoreArg) {
    const result = await restoreOperationsQuarantine({
      batchId: restoreArg.slice('--restore='.length),
      approvalReference: process.env.OPERATIONS_RESTORE_APPROVAL_REFERENCE ?? '',
      actor: process.env.OPERATIONS_QUARANTINE_ACTOR ?? '',
    });
    console.log(JSON.stringify({ ok: true, mode: 'restore', ...result }));
    return;
  }
  const preview = await previewOperationsQuarantine(ids());
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', ...preview }));
    return;
  }
  if (preview.missingIds.length) throw new Error('Candidate list contains Operations Inbox IDs not found in the database.');
  const result = await quarantineOperationsItems({
    ids: ids(),
    confirmationSha256: process.env.OPERATIONS_QUARANTINE_CONFIRM_SHA256 ?? '',
    expectedItemCount: Number(process.env.OPERATIONS_QUARANTINE_EXPECTED_ITEMS),
    reason: process.env.OPERATIONS_QUARANTINE_REASON ?? '',
    actor: process.env.OPERATIONS_QUARANTINE_ACTOR ?? '',
  });
  console.log(JSON.stringify({ ok: true, mode: 'apply', ...result }));
}

run()
  .catch(error => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(() => closeConnection());
