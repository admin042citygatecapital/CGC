# ADR-007: Social Profile and Share Center

**Status:** Accepted  
**Date:** 2026-08-10  
**Decider:** City Gate Capital administration

## Context

The administration panel previously saved public social profile URLs to a single local JSON file. It had no durable activity history and no working sharing workflow. Direct provider publishing would require separate OAuth applications, provider review, token encryption, permission scopes, revocation handling, and platform-specific compliance work.

## Decision

Store official profile links and administrator share activity in PostgreSQL. Provide official browser share intents for X, LinkedIn, Facebook, Telegram, and WhatsApp. For platforms without universal web sharing, copy the approved message and destination URL for manual posting. Restrict the entire administration API to `SUPER_ADMIN` and record mutations in the audit log.

No OAuth tokens or provider secrets are stored by this feature.

## Options considered

1. **Profile links only:** low complexity, but does not satisfy the sharing workflow.
2. **Provider OAuth publishing:** powerful, but unsafe to claim or implement without registered provider applications and approved credentials.
3. **Durable share-intent center:** immediately useful, auditable, and credential-free. Selected.

## Consequences

- Social profile configuration survives deployments and concurrent administration.
- Administrators can share approved content through official provider dialogs.
- The system records that a share flow was opened, not that a provider definitively published the post.
- Direct background publishing remains a future integration requiring provider-specific authorization.

## Rollback

The migration is additive. The previous application version can ignore the new tables, and the legacy JSON file remains readable as an import source.
