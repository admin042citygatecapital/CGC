# City Gate Capital — Admin Control Plane Implementation Plan

**Version:** 1.0 (plan, pre-implementation)
**Date:** 2026-08-19
**Companion:** `CGC-ADMIN-RBAC-DESIGN-SPEC.md`
**Working model chosen:** implement via a **GitHub feature branch**; RBAC **spec-first** (this doc + the spec); **full written plan before any code** (this document).
**Prime directive:** extend the existing admin plane (44 pages, ~230 admin APIs) — preserve working functionality, no placeholder code, no secrets in client, fail-closed financial invariants untouched.

---

## 0. What already exists (so we extend, not rebuild)

From the baseline audit of the repository:

- **~22 of 24 modules already have pages + server APIs.** Auth (Argon2id, email-OTP 2FA, trusted devices, brute-force lockout, CSRF, HttpOnly/Secure/SameSite cookies), blanket mutation auditing, double-entry **simulation** ledgers, Zoho email + SMTP fallback, Supabase Storage media, integrations registry, clean customer/admin separation — **all present and mature.**
- **Genuine gaps:** granular RBAC (biggest), a feature-flag engine/table + `/admin/features` page, standalone `/admin/transfers` + `/admin/finance`, `/admin/notifications` page, explicit dual-approval, dedicated audit columns, and consolidation of a few "Center" screens.

Therefore the build is **foundation + targeted gap-fill + a verification pass**, not a greenfield admin.

**Legend for status columns:** ✅ exists · ◑ partial (extend) · ➕ net-new.

---

## 1. Spec §→work mapping (all 32 sections)

| Spec § | Area | Status | Work |
|---|---|---|---|
| 1 | Admin control plane (keep `/admin/*`) | ✅ | No structural change; add RBAC gating + fill gap pages |
| 2 | SUPER_ADMIN role | ◑ | Exists as sole authority; formalize as top of RBAC; add admin-user/role management UI+API (SUPER-only); ensure still audited |
| 3 | RBAC (8 roles, 40 perms) | ➕ | Per RBAC spec: catalogue, matrix, route→perm map, middleware, migrations, tests |
| 4 | Customer management | ✅ | Ensure every mutation records admin/ts/target/reason/request-id/before/after (audit-field extension) |
| 5 | Account control | ✅/◑ | States exist; add explicit permission gating + limits editing + "no silent delete" guard (soft-close) |
| 6 | Financial operations `/admin/finance` | ◑ | New consolidated page over existing transactions/transfers/rates/reconciliation; manual adjustment via ledger only (direct edit stays `410`); dual approval |
| 7 | Transactions | ✅ | Extend with review/approve/reject where workflow permits; no silent rewrite (already sim-ledgered) |
| 8 | Transfers | ◑ | New `/admin/transfers` page + configurable limits (per txn/day/week/month/tier/currency/type); provider-gated settlement (stays simulation) |
| 9 | Cards | ✅ | Confirm freeze/limits/settings gated; step-up + audit for any sensitive reveal (no CVV/PAN) |
| 10 | Wallets | ✅ | Confirm freeze/enablement toggles gated; no fabricated settlement |
| 11 | Trading | ◑ | Enable/disable, symbols, providers, eligibility, limits; keep market-data ≠ execution; execution stays gated |
| 12 | KYC & compliance | ✅ | States + decisions exist and audited; add reviewer assignment + decision-history view if missing |
| 13 | Security center | ✅ | Confirm all actions gated to SECURITY_MANAGE/SUPER; add "mark alert reviewed"/"add note" if missing |
| 14 | Feature control `/admin/features` | ➕ | Feature-flag **engine + table + page** with targeting (global/type/customer/role/env); flags can't override compliance/providers |
| 15 | Platform configuration `/admin/configuration` | ◑ | Move config from KV blob toward typed, validated, versioned tables with audit history; secrets excluded |
| 16 | Integrations center | ✅ | Registry exists; add health/last-check display; never show full credentials |
| 17 | Email center | ✅ | Queue/logs/templates/test exist; confirm Zoho status; official addresses; no secret exposure |
| 18 | Support & Smartsupp | ✅ | Exists; confirm customer-scoped access + assignment/reply/notes |
| 19 | CMS | ✅/◑ | Exists; add draft→preview→publish + revision history + rollback if not complete |
| 20 | Media | ✅ | Supabase Storage; confirm MIME/size/ownership validation + brand-asset protection |
| 21 | Notification center `/admin/notifications` | ◑ | API exists; new page; targeting (one/group/all); bulk confirmation; delivery tracking |
| 22 | System operations `/admin/system` | ✅ | Health/readiness/env-report exist; add safe controlled actions (cache clear, maintenance toggle, test email), all audited; no shell |
| 23 | Audit center | ✅ | Exists; add dedicated columns (reason/request-id/before-after) + redaction allowlist |
| 24 | Developer/diagnostics | ✅ | Route inventory/docs/env-status(Configured/Missing) exist; ensure no raw env values, no code exec |
| 25 | Website control | ✅ | Via CMS/config/media; confirm logo/hero/banners/nav/footer/SEO/announcements editable |
| 26 | Supabase | ✅ | Postgres+Storage in use; RLS deny-by-default; service-role server-side; RBAC not replaced by RLS |
| 27 | Render | ✅ | PORT/0.0.0.0/health/build/start verified this session (deploy is green) |
| 28 | Admin authentication | ✅ | Mature; confirm no session token leakage in responses |
| 29 | Customer/admin separation | ✅ | Centrally enforced; add negative tests |
| 30 | High-risk safeguards | ➕ | Confirmation + dual approval for the specified action set; show action/target/reason/impact |
| 31 | Testing | ➕ | 5-identity matrix per privileged route; `npm ci/typecheck/lint/test/build`; run app vs Supabase |
| 32 | Final report | ➕ | Produced from real results (template in §5) |

---

## 2. Phased delivery

Each phase is independently reviewable, builds green, and is committed to the feature branch `feat/admin-control-plane`. Phases are ordered so nothing ships half-enforced.

### Phase 1 — RBAC foundation (enforcement + data + audit fields)
**Net-new / extend:**
- `src/server/lib/adminRbac.ts` — role & permission catalogue, role→permission matrix (code-authoritative).
- `adminAuthorizationMiddleware.ts` — replace `allowedRolesForAdminRequest` with `requiredPermissionForAdminRequest(path, method)` + `READ_OVERRIDES`; new permission check; SUPER_ADMIN wildcard; deny-by-default.
- `resolvePermissions(adminUserId)` with short-TTL cache + invalidation.
- Migration `0047_admin_rbac.sql` (tables per spec §6), `0048_audit_rbac_fields.sql` (audit columns), plus seed of roles/permissions/matrix.
- `auditLog.ts` — typed fields + redaction allowlist.
- Admin-user & role management API + page (`/admin/access`), SUPER_ADMIN-only.
- `useAdminAuth` — expose effective permissions for UI hiding (cosmetic only).
**Exit:** all existing routes mapped to permissions; auth-matrix tests green; SUPER_ADMIN unchanged in behavior; build green.

### Phase 2 — High-risk safeguards + dual approval
- `admin_approvals` workflow: `approvalStore.ts`, `/api/admin/approvals/*`, maker/checker.
- Wire the §30 action set (account closure/suspension, ledger adjustment, transfer approve/reject, card/wallet freeze, revoke-all-sessions, role change, KYC rejection, bulk message, CMS publish, feature shutdown) to confirmation + optional dual approval.
- Standard mutation envelope: require `reason`, generate `request_id`, capture before/after, write audit.
**Exit:** high-risk actions cannot execute single-handed where dual approval configured; tests prove maker≠checker.

### Phase 3 — Gap pages/APIs (vertical slices)
- `/admin/finance` (consolidation), `/admin/transfers` (+ configurable limits engine), `/admin/features` (feature-flag engine + table + targeting), `/admin/notifications` (targeting + bulk confirm + delivery tracking).
- Fill any partial: reviewer assignment (KYC), "mark reviewed"/notes (security), CMS draft→preview→publish→rollback if incomplete.
**Exit:** every module in the spec has a page + permission-gated API; no placeholder.

### Phase 4 — Config/flags/CMS persistence hardening
- Move editable non-secret config from the `config` KV blob toward typed, validated, **versioned** tables with audit history and rollback; feature flags persisted with targeting; secrets remain in Render env (never in config tables).
**Exit:** operational changes are DB-driven, validated, versioned, audited — no source edits for normal ops.

### Phase 5 — Verification
- Auth-matrix tests for every privileged route; negative customer/admin-separation tests; dual-approval + fail-closed + flag-vs-platformMode tests; audit assertions.
- `npm ci && npm run type-check && npm run lint && npm run test:ci && npm run build`; run built server against Supabase; smoke major admin/customer workflows.
- Supabase advisors (security/performance); confirm RLS deny-by-default; confirm no secret exposure in `/admin/developer` or `/admin/integrations`.
**Exit:** BUILD PASS, TESTS PASS, RENDER READY, SUPABASE READY — or a precise blocker list.

### Phase 6 — Final Admin Control Report (§5 template).

---

## 3. Cross-cutting rules (applied in every phase)

- **Server-side authorization on every privileged route**; UI hiding never the only guard.
- **Every mutation** records: admin id, role, action, module, resource, resource id, reason, request id, timestamp, result, before/after summary.
- **Redaction allowlist** in the audit writer prevents logging secrets/PII (password, OTP, session token, service-role key, SMTP pw, OAuth token, private key, CVV/PAN).
- **Fail-closed financial invariants** (`platformMode.ts`) untouched; simulation ledgers reused; direct balance edit stays `410`.
- **Secrets** stay in Render env / secure store; never in config tables or browser code; `SUPABASE_SERVICE_ROLE_KEY` server-only.
- **No** shell, arbitrary SQL console, code executor, or unrestricted FS browser in the panel (diagnostics only).
- Each phase ends **green** (typecheck/lint/test/build) before the next.

---

## 4. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Re-introducing multi-role widens attack surface (was retired on purpose) | Fail-closed default, deny unknown routes, SUPER retains authority, full test matrix, audit every check |
| Route→permission map drift as new routes are added | Deny-by-default + a CI test that asserts every mounted `/api/admin` route has a policy entry |
| Stale permissions after a role change mid-session | Resolve permissions per-request with short-TTL cache invalidated on role change (esp. for SECURITY revocations) |
| Config migration from KV blob could break readers | Dual-read shim during transition; versioned tables; no destructive migration |
| Dual approval could deadlock ops with few admins | Configurable per-action; thresholds; SUPER can be sole approver only where policy explicitly allows (audited) |
| Main vs feature-branch drift | Small, frequent PRs; rebase on main; this session's deploy already green on `main` |

---

## 5. Final Admin Control Report — template (filled from real results at the end)

```
ADMIN MODULES
  implemented: [...]
  partial:     [...]
  missing:     [...]

RBAC
  roles:               [8 listed, seeded]
  permissions:         [40 + approved extensions]
  protected endpoints: [count; % of /api/admin routes with policy entry = 100% target]

DATABASE
  tables added/changed: [admin_users, admin_roles, admin_permissions,
                         admin_role_permissions, admin_user_roles, admin_approvals,
                         audit_log(+columns), feature_flags, config_versions, ...]
  migrations:           [0047..00NN]
  RLS:                  [deny-by-default confirmed on new tables]

CONFIGURATION
  admin-editable settings: [currencies, assets, plans, limits, fees, FX markups,
                            KYC policy, card/trading controls, notifications, branding,
                            maintenance mode, dashboard config, feature flags]

INTEGRATIONS
  configured/missing: [Supabase ✓, Render ✓, Zoho ?, Smartsupp ?, market-data ?, monitoring ?]

SECURITY
  audit controls:              [immutable append-only + dedicated fields + redaction]
  session controls:            [revoke/revoke-all, device history, timeouts]
  high-risk action protections:[confirmation + dual approval on the specified set]

BUILD:    PASS / FAIL
TESTS:    PASS / FAIL
RENDER:   READY / NOT READY
SUPABASE: READY / NOT READY

FINAL STATUS: ADMIN CONTROL PLANE COMPLETE | NOT COMPLETE
```

**Honesty rule:** "COMPLETE" is only claimed when frontend controls, backend APIs, RBAC, persistence, audit logging, and production validation all work end-to-end and the test matrix passes. Anything short is reported as NOT COMPLETE with the exact remaining items.

---

## 6. What I need to start building (next session)

1. **Approvals on the RBAC spec's §11 open decisions** (extension permissions, matrix footnotes, multi-role, dual-approval set).
2. **Green light to open `feat/admin-control-plane`** on GitHub and begin **Phase 1**.
3. Because the working model is "GitHub branch," I'll deliver each phase as a reviewable PR; for large generated files (migrations, new libs) I'll stage them so you can commit, and we verify each phase's build green before merging.
