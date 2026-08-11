# Customer Onboarding Control Plane

The onboarding workspace manages platform-profile access and sponsor-readiness evidence. It does not create a bank account or enable deposits, custody, cards, payments, trading, or other financial operations.

## Lifecycle

Customer cases are versioned as `draft`, `submitted`, `under_review`, `needs_info`, `approved`, `rejected`, or `expired`. Individual cases support identity, address, and provider-liveness evidence. Business cases additionally support company, beneficial-ownership, and authorised-user evidence.

Evidence is metadata only: an opaque approved-provider reference, optional lowercase SHA-256 hash, issue/expiry dates, and classification. Customers cannot submit public document URLs or raw files through this control plane. Original identity documents, raw webhook bodies, and provider credentials remain outside the application.

Approval cannot rely on a customer-typed provider reference. An individual requires an accepted identity event; a business requires an accepted KYB event. Both require a separate accepted screening event whose sanctions, PEP, and adverse-media dispositions are explicitly `clear`. These events must arrive through the allow-listed, HMAC-signed provider callback and are stored in the append-only `onboarding_provider_events` ledger.

## Separation of duties

- Compliance administrators and super-admins can access the administration workspace.
- An administrator cannot review a case they submitted or last edited.
- The administrator who approves KYC cannot complete the subsequent AML decision.
- AML and sanctions cases require a different administrator to clear or block a case opened or last edited by another administrator.
- Direct edits to email-verification, KYC, and account-status fields are prohibited. Restrictions use the dedicated audited action API.

## Audit and notifications

`onboarding_events`, `onboarding_provider_events`, and `compliance_case_events` are append-only. PostgreSQL triggers reject updates and deletions. Provider callbacks have a five-minute timestamp window, constant-time HMAC validation, event-ID replay protection, an allow-listed provider code, and a payload SHA-256 digest. Decisions are also written to the central audit log. Customer submission, review, restriction, AML, and sanctions status changes create inbox notifications.

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

Approved provider callback:

- `POST /api/providers/onboarding/webhook/:provider`

The same signed callback supports `purpose: "rescreen"` only for screening
events attached to an already approved onboarding case. A clear result records
the screening time and schedules the next annual review. A provider review or
match result fails closed: the customer AML state moves to review and an
immutable AML or sanctions case is opened for a different compliance
administrator to resolve. Provider callbacks cannot mark the human compliance
case clear or activate financial operations.

Ongoing screening queue:

- `GET /api/admin/onboarding/screening`

The queue is restricted to Compliance administrators and Super Admin. It shows
last/next screening dates and derives an overdue state at read time. Raw provider
payloads, documents and credentials are never returned or stored by the queue.
- Required headers: `x-cgc-event-id`, `x-cgc-timestamp`, and `x-cgc-signature`
- Signature input: `eventId + "." + timestamp + "." + rawRequestBody`, HMAC-SHA-256
- Provider allow-list: `APPROVED_ONBOARDING_PROVIDERS`
- Secret: `ONBOARDING_PROVIDER_WEBHOOK_SECRET_<NORMALIZED_PROVIDER_CODE>`

The customer UI is `/onboarding` (and the existing `/kyc` route uses the same controlled workflow). The administration UI is `/admin/onboarding`.
