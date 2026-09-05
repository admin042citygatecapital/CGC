import { getSecret } from '#runtime/secrets';
import { getOperationalBackupStatus } from './operationalBackup.js';

export function databaseTarget(databaseUrl: string, storageUrl: string) {
  let provider = 'unknown';
  let projectRef: string | null = null;
  let storageProjectRef: string | null = null;
  try {
    const url = new URL(databaseUrl);
    const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
    if (direct) { provider = 'Supabase'; projectRef = direct[1]; }
    else if (/(^|\.)pooler\.supabase\.com$/.test(url.hostname)) {
      provider = 'Supabase';
      projectRef = /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(url.username))?.[1] ?? null;
    } else if (/(^|\.)neon\.tech$/.test(url.hostname)) provider = 'Neon';
    else provider = 'PostgreSQL';
  } catch { /* Never expose a connection-string parsing error. */ }
  try { storageProjectRef = /^([a-z0-9]+)\.supabase\.co$/.exec(new URL(storageUrl).hostname)?.[1] ?? null; } catch { /* Unknown target. */ }
  return { source: 'DATABASE_URL', provider, projectRef, storageProjectRef,
    matchesStorageProject: projectRef && storageProjectRef ? projectRef === storageProjectRef : null };
}

export function restoreEvidence(environment = process.env, now = Date.now()) {
  const date = environment.BACKUP_LAST_RESTORE_TEST_AT?.trim() ?? '';
  const time = Date.parse(date);
  const validDate = /^\d{4}-\d{2}-\d{2}T/.test(date) && Number.isFinite(time) && time <= now;
  const recent = validDate && now - time <= 90 * 86_400_000;
  const reference = environment.BACKUP_RESTORE_EVIDENCE_ID?.trim() ?? '';
  const referenceRecorded = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(reference);
  const managedBackupsAttested = environment.MANAGED_DATABASE_BACKUPS_CONFIRMED === '1';
  return { managedBackupsAttested, lastRestoreTestAt: validDate ? new Date(time).toISOString() : null,
    recent, referenceRecorded, complete: managedBackupsAttested && recent && referenceRecorded };
}

export function getDatabaseEvidence() {
  const local = getOperationalBackupStatus();
  return {
    target: databaseTarget(String(getSecret('DATABASE_URL') || process.env.DATABASE_URL || ''), String(getSecret('SUPABASE_URL') || '')),
    backup: { scope: 'operations_items only', enabled: local.enabled, latestAt: local.latestAt ?? null,
      ageHours: local.ageHours ?? null, checksumValid: local.checksumValid ?? null,
      readable: !local.error, restore: restoreEvidence() },
  };
}
