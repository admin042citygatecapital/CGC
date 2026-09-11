# Reviewed findings release tracker

Scope: adapt relevant reviewed findings to the authoritative City Gate GitHub repository; retain sandbox KYC and disabled live financial execution. No wholesale Airo import, provider-key changes, or database migration.

## Deployed baseline: `a438485` — 2026-09-11

Deployed to production (Render) and verified live:

- GitHub main: `a438485` (merge of PR #71 + PR #72 onto upstream `b3b16d6`).
- Render deploy identity: live `/api/health` `release.commit` = `a438485…`, branch `main`.
- Live components at deploy time: api / database (4 ms) / storage / sessions — all healthy; homepage 200.

### Shipped in this release

| PR | Commit range | Contents |
|---|---|---|
| #71 | `b7f45a6` → `8fc7f3c` | Remediation batches A–F: tab-local background refresh; security hardening (trust proxy, reset throttles, diag key, email preview); data integrity (stop masking errors/fabricating customer data); a11y (dialog semantics, focus management, labels, WCAG contrast); dead-code removal (orphan pages, UI wrappers, 36→24 runtime deps); realtime subscription dedupe + socket teardown leak fix; consolidation (shared formatters, `marketFormat.ts`, permission-filtered admin nav) |
| #72 | `68d4a34` → `3bbf732` | Deploy-chain repairs: junk-duplicate removal, nodemailer diet, `preview-claims` audit list fix (ENOENT), CI build-before-e2e ordering, e2e harness fixes (awaited admin OTP step, `ENABLE_KYC` declared) |

### Verification history (final tree of each PR)

- PR #71: type-check / lint (0 errors, 119 pre-existing warnings) / test:ci 181 files · 824 tests / build clean.
- PR #72 CI: first green e2e run in CI history — 31/31 browser tests, full gate pass.
- Full local e2e: 31/31.

### Historical batches

The original per-batch checkpoint notes (batch 1 background refresh etc.) covered work ported via cherry-pick in the release table above; the branch history in `codex/reviewed-sync-hardening` retains those commit messages.

Only count a batch as deployed after GitHub main, Render deploy identity, and live health release.commit agree and the relevant live checks pass.

## Open items

- Production secret coverage audit (see `docs/PRODUCTION-SECRETS-AUDIT.md`).
- Lint warning burn-down: 119 pre-existing warnings (mostly `no-explicit-any` in tests).
- CI Node 20 deprecation notice from GitHub Actions.