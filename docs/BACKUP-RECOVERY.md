# Backup and recovery runbook

## Coverage

- PostgreSQL is the system of record. Enable the database provider's managed, off-site backups and point-in-time recovery where available.
- The application creates a daily checksummed snapshot of the Operations Inbox under `/private/backups` with 14-day retention.
- The local snapshot is a rapid-recovery aid on the persistent disk; it is not an off-site database backup.

## Manual operational snapshot

Run `npm run backup:operations`. A successful run prints the file, SHA-256 checksum, record count, and compressed size. Never copy backup contents into logs or source control.

## Restore drill

1. Create an isolated PostgreSQL recovery database.
2. Restore the latest provider-managed database snapshot into the isolated database.
3. Run `npm run db:validate` against the isolated database.
4. Confirm `operations_items`, audit records, support records, users, and transactions are present.
5. Exercise login and an Operations Inbox status update without contacting customers or providers.
6. Destroy the isolated recovery database after approval.
7. Record the successful UTC timestamp in `BACKUP_LAST_RESTORE_TEST_AT` and set `MANAGED_DATABASE_BACKUPS_CONFIRMED=1` only when the provider policy is verified.

## Rollback triggers

- Migration fails or `operations_items` is missing.
- Operations Inbox returns errors or loses records.
- Latest local snapshot checksum fails.
- Audit logging fails during an administration update.

Rollback the application release while leaving migration data intact. The previous release continues to use the JSONL fallback record, and migration `0006` is additive and safe to retain.
