# Reviewed findings release tracker

Scope: adapt relevant reviewed findings to the authoritative City Gate GitHub repository; retain sandbox KYC and disabled live financial execution. No wholesale Airo import, provider-key changes, or database migration.

## Batch 1: private background refresh
- Base: origin/main bbdfb5e, fetched for this release.
- Branch: codex/reviewed-sync-hardening.
- Implementation: src/lib/backgroundSync.ts.
- Focused tests: src/lib/backgroundSync.test.ts (5 cases).
- Written: yes.
- Dependency installation: in progress at this checkpoint.
- Focused tests passed: not yet established.
- Full build/release gates: not yet run.
- Committed/pushed/merged: no.
- Render deployment/live revision match: not yet established.

Changes: tab-local scheduling instead of cross-tab broadcast/leader election, listener-owned cleanup, late-result suppression, no overlapping polls per job, visibility pause/resume, current fetcher callback. Trade-off: separate visible tabs may each poll rather than sharing private data. Existing request already in flight cannot be aborted through the current zero-argument fetcher contract; its result is discarded after unregistration.

Only count a batch as deployed after GitHub main, Render deploy identity, and live health release.commit agree and the relevant live checks pass.
