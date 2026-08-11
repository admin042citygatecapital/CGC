# Customer Onboarding Control Plane

The onboarding workspace manages platform-profile access and sponsor-readiness evidence. It does not create a bank account or enable deposits, custody, cards, payments, trading, or other financial operations.

## Lifecycle

Customer cases are versioned as `draft`, `submitted`, `under_review`, `needs_info`, `approved`, `rejected`, or `expired`. Individual cases support identity, address, and provider-liveness evidence. Business cases additionally support company, beneficial-ownership, and authorised-user evidence.

Evidence is metadata only: an opaque approved-provider reference, optional lowercase SHA-256 hash, issue/expiry dates, and classification. Customers cannot submit public document URLs or raw files through this control plane. Original identity documents and provider credentials remain outside the application.

## Separation of duties

- Compliance administrators and super-admins can access the administration workspace.
- An administrator cannot review a case they submitted or last edited.
- The administrator who approves KYC cannot complete the subsequent AML decision.
- AML and sanctions cases require a different administrator to clear or block a case opened or last edited by another administrator.
- Direct edits to email-verification, KYC, and account-status fields are prohibited. Restrictions use the dedicated audited action API.

## Audit and notifications

`onboarding_events` and `compliance_case_events` are append-only. PostgreSQL triggers reject updates and deletions. Decisions are also written to the central audit log. Customer submission, review, restriction, AML, and sanctions status changes create inbox notifications.

## Endpoints

Customer, session-authenticated and same-origin:

- `GET /api/users/onboarding`
- `POST /api/users/onboarding/evidence`
- `POST /api/users/onboarding/submit`

Administration, compliance-authorised:

- `GET /api/admin/onboarding`
- `POST /api/admin/onboarding/review`
- `GET /api/admin/onboarding/compliance-cases`
- `POST /api/admin/onboarding/compliance-cases`

The customer UI is `/onboarding` (and the existing `/kyc` route uses the same controlled workflow). The administration UI is `/admin/onboarding`.
