# ADR-006: PostgreSQL as the Operations Inbox system of record

**Status:** Accepted  
**Date:** 2026-08-10  
**Deciders:** City Gate Capital engineering and operations

## Context

Customer submissions must be searchable, assignable, auditable, durable across deployments, and safe under concurrent administrator updates. The original append-only JSONL inbox was suitable for preview development but did not provide transactional concurrency or managed database recovery.

## Decision

Use the existing managed PostgreSQL database for `operations_items`. Keep JSONL only as a development fallback and one-time migration source. Use a unique `(source, reference_id)` key for idempotency and atomic JSONB appends for notes and history.

## Options considered

### Persistent-disk JSONL

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Concurrency | Weak |
| Recovery | Disk snapshot dependent |
| Portability | Medium |

### PostgreSQL with JSONL fallback

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Concurrency | Strong |
| Recovery | Managed backup compatible |
| Portability | High |

## Consequences

- Administration updates survive redeployments and support concurrent staff use.
- Legacy inbox and intake records are imported idempotently without copying government identifiers or tax numbers.
- Production requires migration `0006_operations_inbox.sql` before the application starts.
- Local snapshots provide rapid operational recovery, while provider-managed off-site backups and tested restores remain mandatory.

## Action items

1. Apply and validate migration `0006_operations_inbox.sql`.
2. Monitor the first automated operational snapshot.
3. Confirm managed PostgreSQL backup retention in the hosting account.
4. Perform a restore drill and record `BACKUP_LAST_RESTORE_TEST_AT`.
