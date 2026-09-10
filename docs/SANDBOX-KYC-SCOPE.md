# Sandbox KYC product scope

The project owner narrowed the scope to sandbox identity verification on 2026-09-05.
This supersedes earlier plans to complete AML integration or activate live financial services.

On 2026-09-09 the project owner authorized an additional, explicitly synthetic
financial sandbox in the deployed administration application. This is a narrow
scope amendment, not approval for banking, production provider verification, or
live financial execution.

## Included

- Sandbox identity-verification integration and its eventual isolated test workflow.
- Administration, support, security, audit, and database diagnostics.
- Preservation of existing account, transaction, and compliance records.
- A SUPER_ADMIN-only financial sandbox at `/admin/financial-sandbox`, with
  synthetic accounts, simulated transfers and isolated journals. Mutations are
  default-off and require explicit administrator enablement.
- A separate default-off KYC approval switch. Enabling it permits only the
  existing evidence-backed review process; it does not turn sandbox results into
  production evidence or approve any customer automatically.

## Excluded

- Live payments, transfers, trading, card issuing, custody, and financial activation.
- AML screening as a requirement of the sandbox identity-verification flow.
- Treating sandbox identity outcomes as production verification or financial authorization.

## Enforcement

`src/shared/productScope.ts` defines the reviewed scope and excluded route prefixes.
Excluded financial links are filtered out of the administrator navigation.
Authenticated direct access to excluded financial screens shows a scope explanation rather than the old controls.
Production financial guards remain in force, and the scope itself is an additional reason that live readiness cannot be satisfied.
The production paper-trading switch cannot override the scope.
Development-only synthetic storage behavior is retained for isolated tests; it does not constitute provider-backed financial activity.
The deployed financial sandbox uses its dedicated PostgreSQL tables, never a
development storage fallback, customer balances, or live provider execution.
Its page and API require SUPER_ADMIN. Both workflow switches require recent
step-up authentication and an audit authorization record before changing.
Authorization reads use the shared `config` record `admin_workflow_controls`
on each request, not the local app configuration cache. Missing or unreadable
shared state disables both workflows. Unrelated configuration saves cannot
overwrite this record. Requests already in progress may complete after disable;
the switches block newly authorized requests, not transactions already admitted.

Financial readiness reports that financial activity is excluded, rather than requesting sponsor or provider activation.
That report does not claim the full sandbox verification flow is complete.
Existing provider-signing configuration and event counts remain identified as existing receiver evidence, not proof of an isolated sandbox connection.

## Data and credential boundaries

This code change does not delete records or alter database schema, stored credentials, provider subscriptions, or production environment variables.
Existing compliance data and low-level financial protections remain intact for historical integrity and defense in depth.
The production webhook receiver continues rejecting sandbox/test evidence.
Sandbox API credentials must not be substituted for production webhook-signing credentials.

## Outstanding integration work

Applicant creation, an isolated sandbox webhook destination and data store, and a genuine provider-signed end-to-end test remain separate work.
The existing Sumsub sandbox webhook was observed pointing at production; no simulated verification should be driven through that destination.

## Release checks

Run type checking, lint, server tests, production build, browser/accessibility checks, claims, smoke, production guard and dependency audit.
Regression coverage must demonstrate that legacy financial screens are excluded while KYC, support and security routes remain available.
It must also prove the explicit financial sandbox exception requires admin
authentication and SUPER_ADMIN API access, remains simulation-only, and rejects
new mutations after the shared switch is disabled.
Release completion requires the same commit on GitHub main, Render and live health.
