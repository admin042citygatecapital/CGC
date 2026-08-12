# Production test-data quarantine runbook

This procedure suspends explicitly identified test customers and classifies their linked application transaction records as synthetic. It never deletes customer, transaction, or audit history.

## Preconditions

1. Create a provider-managed PostgreSQL backup and record its immutable provider reference.
2. Confirm the backup is complete and visible in the provider console.
3. Prepare an exact comma-separated list of test addresses. The tool accepts only reserved domains such as `example.com` and `.test`; all other identities require manual review.
4. Run the preview and compare the candidate count and transaction count with the approved change record.
5. Record the preview's SHA-256 confirmation value. A changed candidate list produces a different value and cannot be applied using an older confirmation.

## Preview

Set `DATABASE_URL` and `QUARANTINE_USER_EMAILS`, then run:

```text
npm run data:quarantine
```

The preview returns hashed email identifiers, record IDs, counts, and the required confirmation hash. It does not change the database and does not print email addresses.

## Apply

Set all of the following only in the controlled operations environment:

- `MANAGED_DATABASE_BACKUPS_CONFIRMED=1`
- `PROVIDER_BACKUP_REFERENCE`
- `QUARANTINE_USER_EMAILS`
- `QUARANTINE_CONFIRM_SHA256`
- `QUARANTINE_REASON`
- `QUARANTINE_ACTOR`

Then run:

```text
npm run data:quarantine -- --apply
```

The operation runs in one PostgreSQL transaction. Any snapshot, audit, session-revocation, classification, or suspension failure rolls back the entire batch.

## Restore

Restoration requires a separately approved change reference. Set `RESTORE_APPROVAL_REFERENCE` and `QUARANTINE_ACTOR`, then run:

```text
npm run data:quarantine -- --restore=dqb_BATCH_ID
```

Every append-only snapshot hash is checked before restoration. Restoring classification and account status does not recreate revoked sessions; affected users must authenticate again.

## Invariants

- Financial operations remain locked.
- No passwords, tokens, KYC documents, card secrets, or provider credentials enter quarantine snapshots.
- Customer and transaction rows are never deleted.
- Quarantined test data is excluded from administration KPIs.
- Each apply and restore operation creates an immutable audit event.
