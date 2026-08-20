# Phase 1 increment 2 — Audit-field hardening + redaction

**Branch:** `feat/admin-control-plane-rbac` (same branch as increment 1)
**Status in cloud:** type-check ✅ · lint ✅ · **516/516 server tests ✅**
**Scope:** additive, backward-compatible. Existing `appendAudit`/`appendCriticalAudit` call-sites are unchanged; new structured fields are optional.

## New files
| Path | What it is |
|---|---|
| `src/server/lib/auditRedaction.ts` | Deep redaction allowlist. `redactSensitive()` walks objects/arrays (depth-bounded, Date-safe, non-mutating) and replaces the value of any sensitive key with `[REDACTED]`. Covers password, OTP, session/access/refresh/oauth tokens, service-role key, SMTP password, private key, API key, CVV/CVC, PAN, client secret. Exact-match guards (`pan`, `otp`, `token`, `pin`) avoid false positives like `plan`/`company`. |
| `src/server/db/migrations/0048_audit_rbac_fields.sql` | Adds `role, permission, module, resource, resource_id, reason, request_id, result, before_summary, after_summary` to `audit_log` (idempotent `ADD COLUMN IF NOT EXISTS`) + two indexes. **⚠ Renumber** to follow main's latest. |
| `src/test/server/auditRedaction.test.ts` | Verifies forbidden keys redacted at every depth, legitimate keys preserved, structure/immutability, and primitive/Date handling. |

## Changed files
| Path | Change |
|---|---|
| `src/server/lib/auditLog.ts` | `AuditEntry` extended with the optional structured fields. `appendAuditEntry` now **redacts** `details`/`beforeSummary`/`afterSummary` before persisting (DB **and** flat-file paths) and writes the new columns; `getAuditLog` returns them via a shared `mapAuditRow`. |
| `src/server/db/schema.ts` | `audit_log` table gains the 10 new nullable columns. (This file also carries increment-1's `adminRoleEnum` widening — it is the cumulative version.) |

## Guarantee
No audit write can persist a secret even if a call-site passes one: redaction is applied centrally in `appendAuditEntry`, ahead of both storage backends.
