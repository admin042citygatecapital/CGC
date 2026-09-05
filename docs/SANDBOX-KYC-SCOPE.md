# Sandbox KYC product scope

The project owner narrowed the scope to sandbox identity verification on 2026-09-05.
This supersedes earlier plans to complete AML integration or activate live financial services.

## Included

- Sandbox identity-verification integration and its eventual isolated test workflow.
- Administration, support, security, audit, and database diagnostics.
- Preservation of existing account, transaction, and compliance records.

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
Release completion requires the same commit on GitHub main, Render and live health.
