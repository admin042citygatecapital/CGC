import { closeConnection } from '../src/server/db/db.js';
import {
  previewTestDataQuarantine, quarantineTestData, restoreQuarantineBatch,
} from '../src/server/lib/dataQuarantine.js';

function emails(): string[] {
  return String(process.env.QUARANTINE_USER_EMAILS ?? '').split(',');
}

async function run() {
  const restoreArg = process.argv.find(value => value.startsWith('--restore='));
  if (restoreArg) {
    const result = await restoreQuarantineBatch({
      batchId: restoreArg.slice('--restore='.length),
      approvalReference: process.env.RESTORE_APPROVAL_REFERENCE ?? '',
      actor: process.env.QUARANTINE_ACTOR ?? '',
    });
    console.log(JSON.stringify({ ok: true, mode: 'restore', ...result }));
    return;
  }

  const preview = await previewTestDataQuarantine(emails());
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', ...preview }));
    return;
  }
  if (preview.missingEmailHashes.length) throw new Error('Candidate list contains addresses not found in the database.');
  const result = await quarantineTestData({
    emails: emails(),
    confirmationSha256: process.env.QUARANTINE_CONFIRM_SHA256 ?? '',
    providerBackupReference: process.env.PROVIDER_BACKUP_REFERENCE ?? '',
    providerBackupVerifiedAt: process.env.PROVIDER_BACKUP_VERIFIED_AT ?? '',
    expectedCustomerCount: Number(process.env.QUARANTINE_EXPECTED_CUSTOMERS),
    expectedTransactionCount: Number(process.env.QUARANTINE_EXPECTED_TRANSACTIONS),
    reason: process.env.QUARANTINE_REASON ?? '',
    actor: process.env.QUARANTINE_ACTOR ?? '',
  });
  console.log(JSON.stringify({ ok: true, mode: 'apply', ...result }));
}

run()
  .catch(error => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(() => closeConnection());
