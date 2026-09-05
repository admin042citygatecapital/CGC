# Admin and provider readiness evidence - 2026-09-05

Baseline: GitHub main, Render and public health matched 72bd2012c6a2344657a7622a81048f2ed186211c.
This record distinguishes observations from outstanding evidence. It is not launch approval.

## Sumsub

- Receiver: POST /api/providers/onboarding/webhook/sumsub. The Express parser preserves raw request bytes.
- Approval configuration: APPROVED_ONBOARDING_PROVIDERS must include sumsub.
- Signing configuration: ONBOARDING_PROVIDER_WEBHOOK_SECRET_SUMSUB, at least 32 characters, matched to the existing provider webhook secret. No key was changed during this review.
- Headers: x-payload-digest and x-payload-digest-alg. HMAC_SHA256_HEX and HMAC_SHA512_HEX are supported; constant-time verification precedes persistence.
- Applicant externalUserId must equal the application's oc_ onboarding case ID, not a user ID or email address.
- Completed applicantReviewed events map to identity or company verification. GREEN does not establish sanctions, PEP or adverse-media clearance. RETRY rejections require review.
- Sandbox and manually generated test events are rejected from production evidence.
- The current implementation has no applicant creation / WebSDK token flow and no explicit Sumsub AML-result mapping. These are implementation gaps, not missing dashboard switches.
- Supabase aggregate query at review time: zero onboarding_provider_events; four draft cases and one under_review case; all five screening_status values were not_run.
- Sumsub dashboard was logged out. Provider webhook delivery logs, verification-level settings and approved account configuration could not be independently checked.
- A non-creating unsigned live probe returned 401 INVALID_SIGNATURE_ALGORITHM rather than PROVIDER_NOT_APPROVED or PROVIDER_SECRET_MISSING. Given the verified handler ordering, the existing allow-list and signing-secret configuration pass their initial checks. This does not verify the secret matches Sumsub. The old onboarding "PROVIDERS DISCONNECTED" badge was hard-coded, so it was not a measurement of receiver configuration.
- Before claiming end-to-end success: obtain provider-approved test access, use an isolated non-production case/database, verify applicant-to-case correlation, deliver genuine provider-signed results, assert evidence and immutable events, test duplicates/tampering and concurrent case changes, and verify AML remains blocked without explicit screening evidence. Do not manufacture a production pass or use a real customer's identity for a synthetic test.

## Database authority and recovery

- The running application reads DATABASE_URL through the protected runtime secret resolver; it does not select its database based on which dashboard tab is open.
- Supabase project chdpquotirulzmycpcxm contains the observed onboarding tables and cases. New protected diagnostics report the actual DATABASE_URL provider/project, storage project and project alignment without returning connection strings or credentials.
- Local operational backups contain operations_items only. They are not full PostgreSQL or Supabase Storage backups.
- Supabase Scheduled Backups showed seven physical backups, August 29 through September 4, 2026. Latest observed: 2026-09-04T23:04:18Z. Project metadata reports ACTIVE_HEALTHY, PostgreSQL 17, eu-central-1. This confirms managed backup history exists, not that a restore has been exercised.
- Supabase explicitly states that Storage API objects are excluded from these database backups. An isolated restore exercise, storage-object recovery and measured RPO/RTO evidence remain outstanding.
- Restore evidence must record: project, backup identifier and UTC timestamp, isolated restore destination, operator/reviewer, row-count and integrity checks, authentication/onboarding smoke results, elapsed recovery time, measured data loss, and private report reference. Do not restore over production to perform this test.
- Readiness requires a recent past BACKUP_LAST_RESTORE_TEST_AT (within 90 days), an opaque BACKUP_RESTORE_EVIDENCE_ID and MANAGED_DATABASE_BACKUPS_CONFIRMED=1, plus a recent verified local snapshot. Set these only after actual evidence exists; configuration is an attestation, not proof of an exercise performed by code.

## Launch requirements awaiting real evidence

| Requirement | Observed state | Required next evidence |
| --- | --- | --- |
| Launch country and product scope | Onboarding says jurisdiction undecided; crypto copy refers to a UK sponsor package | Confirm approved country, entity, products and exclusions with accountable decision-makers |
| Legal entity and control | Zero legal_entity_profiles rows; local authority pack includes DRAFT documents | Verified registry reference, executed authority documents, independently verified controllers, required review |
| Sponsor/programme | Financial gate incomplete | Executed sponsor/programme agreements and acceptance, allocation of responsibilities |
| KYC/AML | Receiver code exists; no recorded provider events | Approved Sumsub settings, applicant integration, explicit screening results, operating evidence |
| Payments and ledger | Live adapters explicitly not implemented | Contracted rails, idempotency, signed events, reconciled authoritative ledger, exception controls |
| Cards and custody | Deferred / no live adapters | Keep excluded unless scope, contracts and implementation are approved |
| Operating controls | Gate attestations missing | Compliance owner, monitoring, maker-checker, rescreening, disclosures, retention, incident response and independent security evidence |
| Recovery | Local operational snapshot only | Managed backup policy and witnessed isolated restore with evidence |

No draft document, environment flag or dashboard edit substitutes for a signed agreement or independent approval. The financial execution gate remains locked.

The supplied Organization Profile CURRENT (13 August 2026) names CITYGATE CAPITAL LIMITED, company 11575573. Companies House currently lists that company as active and a private limited company: https://find-and-update.company-information.service.gov.uk/company/11575573 . This supports a proposed UK entity record; it does not establish the user's signatory authority, sponsor acceptance or approved launch jurisdiction. The profile also mentions Neon "where configured" and must not be used as the authority for the current production database.

## Release checks

Run type checking, lint, server tests, build, claims, smoke, production guard, dependency audit and applicable browser tests. Record failures without bypassing the gate. After release, compare GitHub main, Render deployment revision and /api/health.release.commit. Verify authenticated integrations/readiness, Sumsub evidence display, database lineage and session wording. Provider end-to-end verification remains a separate milestone from deployment.

Sources: https://docs.sumsub.com/docs/user-verification-webhooks and https://docs.sumsub.com/docs/webhooks .
