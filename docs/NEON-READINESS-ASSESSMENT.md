# Neon PostgreSQL Readiness Assessment

Assessment date: 2026-08-11. This records non-secret configuration metadata observed in the authenticated Neon console. It does not approve a database migration or replace the currently deployed PostgreSQL connection.

## Observed configuration

- Project: `city-gate-capital-prod` (`little-scene-54614919`).
- Default branch: `production` (`br-proud-dream-atm5zwxy`), with `staging` and `development` branches also present.
- Database: `neondb`, owned by `neondb_owner`.
- A separate `citygate_app` role exists. Runtime use still requires a least-privilege grant review and connection test.
- PostgreSQL 18 in AWS US East 1 (N. Virginia), default compute range 0.25-2 CU.
- Neon Data API and BetterAuth are enabled. The application currently implements its own server-side authentication and does not rely on either feature; their need and exposure must be reviewed.
- Plan: Free. History retention: six hours.
- IP restrictions: none. VPC: not configured. Production branch protection is unavailable on the current plan.

## Credential handling finding

Two externally supplied text files contain only usernames and passwords for privileged roles corresponding to `authenticator` and `neondb_owner`. They are not complete connection configuration and must not be committed, logged, or installed as the application runtime credential. Because plaintext credentials were exported, rotate them before any future use. Prefer a dedicated `citygate_app` connection string with minimum schema/table privileges, mandatory TLS, pooled and direct variants separated by purpose, and secret storage in the deployment provider.

## Production gaps

1. Confirm whether Neon is an intended migration target or an unused parallel database. Do not overwrite the healthy deployed database without an approved migration and rollback plan.
2. Upgrade to a plan that meets approved retention, point-in-time recovery, branch protection, support and availability requirements.
3. Restrict network access where supported and document any unavoidable public endpoint exposure.
4. Review and revoke unnecessary roles, grants, Data API access and BetterAuth exposure.
5. Create provider-managed backups, verify retention, restore into an isolated branch, and record measured RPO/RTO evidence in the assurance register.
6. Validate region, data residency, subprocessors, encryption, incident notification, deletion, export and exit provisions with privacy, security, sponsor and legal owners.
7. Run migration rehearsal, row-count/integrity comparison, application smoke tests and reconciliation before a controlled cutover.

No item in this assessment enables real funds or proves disaster-recovery acceptance.
