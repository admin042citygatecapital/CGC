-- Forward-compatible guard for environments that applied migration 0017
-- before provider backup verification time became mandatory. Do not invent or
-- backfill an attestation: deployment fails if an existing batch lacks one.
ALTER TABLE data_quarantine_batches
  ADD COLUMN IF NOT EXISTS provider_backup_verified_at TIMESTAMPTZ;

ALTER TABLE data_quarantine_batches
  ALTER COLUMN provider_backup_verified_at SET NOT NULL;

