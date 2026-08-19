# City Gate Capital — Admin RBAC Design Specification

**Version:** 1.0 (design, pre-implementation)
**Date:** 2026-08-19
**Status:** For review. No code changed. Implementation deferred to an approved feature branch.
**Author context:** Extends the existing admin plane (44 pages, ~230 admin API handlers) rather than replacing it.

---

## 0. Executive summary

Today the admin API enforces a **single administration authority**: `allowedRolesForAdminRequest()` returns `[]` for every protected route, and `requireAdminAuthorization()` grants access only when `session.role === 'SUPER_ADMIN'`. Multi-role RBAC was deliberately retired (the `security/roles` endpoint returns `410`). Authentication, CSRF, blanket mutation auditing, and fail-closed financial gating are already mature and are **not** changed by this design.

This spec introduces **explicit, server-side, fail-closed RBAC**: 8 roles, a permission catalogue (the 40 named permissions plus 6 proposed extensions for modules the spec omits), a role→permission matrix, a route→permission policy map, and the middleware/DB/audit changes to enforce it. The design is **additive and reversible**: SUPER_ADMIN retains unrestricted access, unknown routes continue to fail closed, and RLS/fail-closed financial invariants are preserved.

**Guiding invariants (unchanged):**
1. Authorization is enforced **server-side per route**; UI hiding is cosmetic only.
2. **Unknown/new routes fail closed** (deny by default).
3. **SUPER_ADMIN** is the only role that can manage admins, roles, permissions, integrations secrets surface, config, and system settings — and it **still passes through audit logging** (no bypass).
4. No change to `platformMode.ts` fail-closed financial constants; RBAC never enables money movement.
5. RLS remains deny-by-default; **RBAC does not replace server-side checks** for privileged operations.

---

## 1. Roles

Eight roles. `SUPER_ADMIN` is the wildcard authority; the rest are least-privilege operational roles. Roles are assigned to admin users; an admin may hold **one or more** roles (effective permissions are the union).

| Role | Purpose | Manage scope |
|------|---------|--------------|
| `SUPER_ADMIN` | Root authority | Everything, incl. admin users, roles, permissions, integrations, config, system, operational limits, customer/account restrictions |
| `FINANCE_ADMIN` | Financial operations | Transactions, transfers (+approve), manual ledger adjustments, rates/fees/FX, limits, reconciliation, reports |
| `COMPLIANCE_ADMIN` | KYC & regulatory | KYC review/decisions, compliance cases, AML flags, audit read, customer/transaction read |
| `SECURITY_ADMIN` | Security operations | Security center, sessions/devices, account lock/restrict, force reset/2FA, security notes, audit read |
| `SUPPORT_ADMIN` | Customer support | Tickets, Smartsupp, customer read, customer notifications, email read |
| `CONTENT_ADMIN` | Site content | CMS, media, website/social/links, announcements, branding config (read) |
| `OPERATIONS_ADMIN` | Platform ops | System/health, integrations (read), feature flags, operations inbox, readiness, config (read) |
| `AUDITOR` | Read-only oversight | All `*_READ` permissions + `AUDIT_READ`; **no** `*_MANAGE`/`*_APPROVE` |

**SUPER_ADMIN semantics:** `requireAdminAuthorization` short-circuits to `next()` for `SUPER_ADMIN` **after** authentication and **before** the handler, exactly as today — but the request still flows through CSRF and `auditAdminMutation`. SUPER_ADMIN is never exempt from audit.

---

## 2. Permission catalogue

### 2.1 The 40 named permissions (verbatim from spec)

```
USERS_READ            USERS_MANAGE
ACCOUNTS_READ         ACCOUNTS_MANAGE
TRANSACTIONS_READ     TRANSACTIONS_MANAGE
TRANSFERS_READ        TRANSFERS_MANAGE       TRANSFERS_APPROVE
CARDS_READ            CARDS_MANAGE
WALLETS_READ          WALLETS_MANAGE
TRADING_READ          TRADING_MANAGE
RATES_READ            RATES_MANAGE
KYC_READ              KYC_MANAGE
SECURITY_READ         SECURITY_MANAGE
SUPPORT_READ          SUPPORT_MANAGE
EMAIL_READ            EMAIL_MANAGE
CMS_READ              CMS_MANAGE
MEDIA_READ            MEDIA_MANAGE
INTEGRATIONS_READ     INTEGRATIONS_MANAGE
FEATURE_FLAGS_READ    FEATURE_FLAGS_MANAGE
CONFIG_READ           CONFIG_MANAGE
AUDIT_READ
SYSTEM_READ           SYSTEM_MANAGE
```

### 2.2 Proposed extension permissions (6) — modules that exist but the 40 don't name

The codebase ships modules the literal 40 don't cover. To keep "every privileged route maps to a permission" true and fail-closed, the following are **proposed additions** (flagged for your approval; if declined, these routes map to the nearest listed permission as noted):

| Proposed permission | Covers | If declined, falls back to |
|---|---|---|
| `COMPLIANCE_READ` / `COMPLIANCE_MANAGE` | `/admin/compliance`, compliance cases, AML | `KYC_READ` / `KYC_MANAGE` |
| `NOTIFICATIONS_MANAGE` | `/admin/notifications/send`, bulk customer messaging | `SUPPORT_MANAGE` |
| `ADMIN_USERS_MANAGE` | Admin user CRUD, role assignment | `SUPER_ADMIN`-exclusive (no fallback) |
| `ROLES_MANAGE` | Role/permission definition changes | `SUPER_ADMIN`-exclusive (no fallback) |

`ADMIN_USERS_MANAGE` and `ROLES_MANAGE` are **structurally reserved to `SUPER_ADMIN`** regardless — they are listed as permissions only so the audit trail names them; no non-super role may ever hold them.

### 2.3 Permission semantics

- `*_READ` — view lists, detail, history, export (where export is read-only).
- `*_MANAGE` — create/update/state-change/delete-where-permitted within the module.
- `TRANSFERS_APPROVE` — the **approve/reject** decision specifically, separable from `TRANSFERS_MANAGE` (so a maker cannot be the checker; see §7 dual approval).
- `AUDIT_READ` — read the audit center; **no one** gets "AUDIT_MANAGE" (audit is append-only by design).
- `SYSTEM_MANAGE` — maintenance mode, cache clear, config validation, test email — **never** shell/SQL/code execution.

---

## 3. Role → permission matrix

`●` = granted, `–` = not granted. `SUPER_ADMIN` = all (wildcard, shown for completeness). `AUDITOR` = all reads only.

| Permission | SUPER | FINANCE | COMPLIANCE | SECURITY | SUPPORT | CONTENT | OPERATIONS | AUDITOR |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| USERS_READ | ● | ● | ● | ● | ● | – | ● | ● |
| USERS_MANAGE | ● | – | – | ●¹ | – | – | – | – |
| ACCOUNTS_READ | ● | ● | ● | ● | ● | – | ● | ● |
| ACCOUNTS_MANAGE | ● | ● | – | – | – | – | – | – |
| TRANSACTIONS_READ | ● | ● | ● | – | – | – | ● | ● |
| TRANSACTIONS_MANAGE | ● | ● | – | – | – | – | – | – |
| TRANSFERS_READ | ● | ● | ● | – | – | – | ● | ● |
| TRANSFERS_MANAGE | ● | ● | – | – | – | – | – | – |
| TRANSFERS_APPROVE | ● | ●² | – | – | – | – | – | – |
| CARDS_READ | ● | ● | ● | ● | ● | – | ● | ● |
| CARDS_MANAGE | ● | ● | – | ●³ | – | – | – | – |
| WALLETS_READ | ● | ● | ● | ● | – | – | ● | ● |
| WALLETS_MANAGE | ● | ● | – | ●³ | – | – | – | – |
| TRADING_READ | ● | ● | – | – | – | – | ● | ● |
| TRADING_MANAGE | ● | ● | – | – | – | – | – | – |
| RATES_READ | ● | ● | – | – | – | – | ● | ● |
| RATES_MANAGE | ● | ● | – | – | – | – | – | – |
| KYC_READ | ● | ● | ● | ● | ● | – | – | ● |
| KYC_MANAGE | ● | – | ● | – | – | – | – | – |
| COMPLIANCE_READ | ● | ● | ● | ● | – | – | – | ● |
| COMPLIANCE_MANAGE | ● | – | ● | – | – | – | – | – |
| SECURITY_READ | ● | – | ● | ● | – | – | ● | ● |
| SECURITY_MANAGE | ● | – | – | ● | – | – | – | – |
| SUPPORT_READ | ● | – | – | – | ● | ● | ● | ● |
| SUPPORT_MANAGE | ● | – | – | – | ● | – | – | – |
| NOTIFICATIONS_MANAGE | ● | – | – | ●⁴ | ● | ● | – | – |
| EMAIL_READ | ● | ● | ● | ● | ● | ● | ● | ● |
| EMAIL_MANAGE | ● | – | – | – | – | ● | ● | – |
| CMS_READ | ● | – | – | – | – | ● | ● | ● |
| CMS_MANAGE | ● | – | – | – | – | ● | – | – |
| MEDIA_READ | ● | – | – | – | – | ● | ● | ● |
| MEDIA_MANAGE | ● | – | – | – | – | ● | – | – |
| INTEGRATIONS_READ | ● | ● | ● | ● | – | – | ● | ● |
| INTEGRATIONS_MANAGE | ● | – | – | – | – | – | – | – |
| FEATURE_FLAGS_READ | ● | ● | ● | ● | ● | ● | ● | ● |
| FEATURE_FLAGS_MANAGE | ● | – | – | – | – | – | ●⁵ | – |
| CONFIG_READ | ● | ● | ● | ● | ● | ● | ● | ● |
| CONFIG_MANAGE | ● | – | – | – | – | –⁶ | – | – |
| AUDIT_READ | ● | ● | ● | ● | – | – | ● | ● |
| SYSTEM_READ | ● | ● | ● | ● | ● | ● | ● | ● |
| SYSTEM_MANAGE | ● | – | – | – | – | – | ●⁷ | – |
| ADMIN_USERS_MANAGE | ● | – | – | – | – | – | – | – |
| ROLES_MANAGE | ● | – | – | – | – | – | – | – |

**Footnotes (policy choices to confirm):**
1. `SECURITY_ADMIN` gets `USERS_MANAGE` **scoped to security actions only** (suspend, restrict, revoke sessions, force reset/2FA) — see §5 action-scoped permissions. If you prefer, split into `USERS_SECURITY_MANAGE`.
2. `TRANSFERS_APPROVE` for `FINANCE_ADMIN` is subject to **maker/checker**: the admin who created/edited a transfer cannot approve it (enforced server-side even if they hold the permission).
3. `CARDS_MANAGE`/`WALLETS_MANAGE` for `SECURITY_ADMIN` is **freeze/suspend only** (risk containment), not issuance/limits — action-scoped.
4. `SECURITY_ADMIN` `NOTIFICATIONS_MANAGE` limited to **security notices**.
5. `FEATURE_FLAGS_MANAGE` for `OPERATIONS_ADMIN` **cannot** enable flags that the compliance/provider gate forbids (flags never override `platformMode` — see §8).
6. `CONTENT_ADMIN` `CONFIG_MANAGE` is **branding/CMS-adjacent config only** if you want it; default is deny (SUPER only). Recommend deny.
7. `OPERATIONS_ADMIN` `SYSTEM_MANAGE` excludes anything that could affect financial state; limited to health checks, cache clear, maintenance mode, test email.

---

## 4. Route → permission policy map

The single source of truth becomes a policy table consumed by `allowedRolesForAdminRequest`'s successor, `requiredPermissionForAdminRequest(path, method)`. It maps a normalized route prefix + method class (`READ` = GET/HEAD; `WRITE` = POST/PUT/PATCH/DELETE) to a required permission. **Any route not in the table → deny (fail closed).**

| Route prefix (`/api/admin/…`) | READ perm | WRITE perm |
|---|---|---|
| `users`, `contacts` | USERS_READ | USERS_MANAGE |
| `customer-accounts`, `customer-relationships`, `banking` | ACCOUNTS_READ | ACCOUNTS_MANAGE |
| `transactions` | TRANSACTIONS_READ | TRANSACTIONS_MANAGE |
| `transactions/*/approve|reject` | TRANSACTIONS_READ | TRANSFERS_APPROVE |
| `transfers`, `financial-sandbox`, `money-movement*` | TRANSFERS_READ | TRANSFERS_MANAGE |
| `transfers/*/approve|reject` | TRANSFERS_READ | TRANSFERS_APPROVE |
| `balance/history` | TRANSACTIONS_READ | — |
| `balance/adjust` | — | TRANSACTIONS_MANAGE *(currently `410` retired; stays retired)* |
| `cards` | CARDS_READ | CARDS_MANAGE |
| `wallets` | WALLETS_READ | WALLETS_MANAGE |
| `trading` | TRADING_READ | TRADING_MANAGE |
| `rates`, `settings/rates` | RATES_READ | RATES_MANAGE |
| `kyc`, `onboarding`, `legal-entity` | KYC_READ | KYC_MANAGE |
| `compliance`, `onboarding/compliance-cases` | COMPLIANCE_READ | COMPLIANCE_MANAGE |
| `security`, `auth/trusted-devices` | SECURITY_READ | SECURITY_MANAGE |
| `security/sessions`, `security/devices` | SECURITY_READ | SECURITY_MANAGE |
| `support`, `tickets`, `disputes`, `smartsupp`, `chatbot` | SUPPORT_READ | SUPPORT_MANAGE |
| `notifications/send` | — | NOTIFICATIONS_MANAGE |
| `email`, `smtp`, `newsletter`, `zoho` | EMAIL_READ | EMAIL_MANAGE |
| `cms`, `website`, `social`, `links` | CMS_READ | CMS_MANAGE |
| `media` | MEDIA_READ | MEDIA_MANAGE |
| `integrations` | INTEGRATIONS_READ | INTEGRATIONS_MANAGE |
| `features` | FEATURE_FLAGS_READ | FEATURE_FLAGS_MANAGE |
| `config`, `settings` | CONFIG_READ | CONFIG_MANAGE |
| `audit` | AUDIT_READ | — |
| `health`, `readiness`, `stats`, `env-report`, `reconciliation`, `operations`, `provider-sandbox`, `sponsor-readiness`, `assurance-exercises` | SYSTEM_READ | SYSTEM_MANAGE |
| `developer`, `documentation`, `search` | SYSTEM_READ | SYSTEM_MANAGE |
| `reports` | AUDIT_READ *(or REPORTS_READ if added)* | — |
| `auth/*` (login, otp, password-reset, unlock, verify, diag) | *(public allowlist — unchanged)* | *(public allowlist)* |

**Method nuance:** some POST routes are semantically reads (e.g. a search that takes a body). These are enumerated as explicit exceptions in the policy table (a small `READ_OVERRIDES` set), not left to the GET/WRITE heuristic.

---

## 5. Action-scoped permissions (fine-grained cases)

A few routes need finer control than module-level `*_MANAGE`. Modeled as **sub-permissions** checked inside the handler after the coarse route check:

- `users/*/suspend|restrict|revoke-sessions|reset-2fa|reset-password` → require `USERS_MANAGE` **or** (`SECURITY_MANAGE` + action ∈ security set). Lets SECURITY_ADMIN take containment actions without full user management.
- `cards/*/freeze`, `wallets/*/freeze` → `CARDS_MANAGE|WALLETS_MANAGE` **or** `SECURITY_MANAGE` (freeze-only).
- `transfers/*/approve|reject` → `TRANSFERS_APPROVE` **and** maker ≠ checker.

These are declared in a per-route `actionPolicy` map so they remain auditable and testable, not buried in ad-hoc `if` branches.

---

## 6. Data model (migrations)

New migration `0047_admin_rbac.sql` (additive; no destructive changes). All tables RLS-enabled, deny-by-default (service-role server access only, consistent with existing tables).

```
admin_users            -- promote env-only identity into a managed table
  id (uuid pk), email (unique, citext), display_name,
  status (active|suspended|disabled), created_at, updated_at,
  created_by (admin_users.id), last_login_at
  -- password hash stays in adminCredentials/env for the bootstrap SUPER_ADMIN;
  -- managed admins store argon2id hash here (never logged, never returned)

admin_roles            -- catalogue of the 8 roles (seeded, code-authoritative)
  id (text pk = role key), label, description, is_system (bool)

admin_permissions      -- catalogue of the 40 + 6 permissions (seeded)
  id (text pk = permission key), label, module, description

admin_role_permissions -- role→permission matrix (seeded from §3; editable by SUPER_ADMIN)
  role_id (fk), permission_id (fk), PRIMARY KEY (role_id, permission_id)

admin_user_roles       -- assignment (an admin may hold several roles)
  admin_user_id (fk), role_id (fk), granted_by, granted_at,
  PRIMARY KEY (admin_user_id, role_id)

admin_approvals        -- dual-approval workflow (see §7)
  id (uuid pk), action_key, resource, resource_id, requested_by,
  reason, payload (jsonb), status (pending|approved|rejected|expired),
  approver_id, decided_at, decision_reason, request_id, created_at, expires_at
```

**Role/permission catalogue is code-authoritative**: the 8 roles and permission keys are defined in a TypeScript constant (`adminRbac.ts`) and **seeded** into the tables by migration. SUPER_ADMIN may adjust `admin_role_permissions` grants at runtime, but cannot invent new permission keys the code doesn't recognize (unknown keys are ignored by the enforcement layer → fail closed).

**Session:** `Session.role` (single) is extended to `Session.roles: AdminRole[]` **or** kept single with a derived-permissions lookup at request time. Recommended: keep the DB session row lean (store `adminUserId`), and **resolve effective permissions per request** from `admin_user_roles` + `admin_role_permissions` with a short-lived in-process cache (invalidated on role change). This avoids stale-permission sessions after a role change (important for SECURITY revocations).

---

## 7. Enforcement flow

Order in `entry.ts` `/api/admin` chain (existing → new step inserted):

```
enforceSecurityNetworkPolicy
  → public allowlist? → handler
  → requireAdminAuth            (existing: authenticates, sets req.adminSession)
  → requireAdminAuthorization   (REPLACED: permission-based, fail-closed)
  → csrfProtect                 (existing, cookie writes)
  → auditAdminMutation          (existing blanket audit)
  → handler                     (may add action-scoped checks + maker/checker)
```

New `requireAdminAuthorization`:

```
perm = requiredPermissionForAdminRequest(req.path, req.method)   // null = public
if perm === null: next()
if !req.adminSession: 401
if session is SUPER_ADMIN: next()                 // wildcard, still audited downstream
effective = resolvePermissions(session.adminUserId) // cached
if effective.has(perm): next()
else: 403 { code: 'PERMISSION_REQUIRED', permission: perm }
```

**Dual approval (§30 high-risk):** for a configured set of `action_key`s (account closure, manual ledger adjustment, transfer approval above threshold, role change, bulk message, feature shutdown, wallet/card freeze at scale), the handler does not execute immediately; it writes an `admin_approvals` row (`pending`) and returns `202 { approvalId }`. A second admin with the required permission (and ≠ requester) approves via `/api/admin/approvals/{id}/approve`, which executes the queued action inside a DB transaction and writes the audit record. Maker/checker is enforced server-side.

---

## 8. Fail-closed & non-bypass guarantees

1. **Deny-by-default:** any route absent from the policy map → 403. New modules must be added explicitly (mirrors today's `return []`).
2. **Flags never override compliance/providers:** `FEATURE_FLAGS_MANAGE` cannot flip a flag whose enablement depends on `platformMode` live-readiness; the flag service consults `platformMode.ts` and refuses.
3. **RBAC ≠ money movement:** no permission enables `requireFinancialOperations`; that stays code-level + env-attested.
4. **SUPER_ADMIN audited:** wildcard access still passes through `auditAdminMutation` and, for regulated mutations, `appendCriticalAudit` (fail-closed pre-write).
5. **RLS unchanged:** privileged reads/writes still run server-side with service role; RLS stays deny-by-default and is not used as the RBAC layer.
6. **No UI-only authority:** the frontend `useAdminAuth` will expose the effective permission set purely to hide controls; every gated call is re-checked server-side.

---

## 9. Audit integration (schema extension)

Migration `0048_audit_rbac_fields.sql` adds dedicated columns to `audit_log` (keeping `details` jsonb for back-compat and extras):

```
role            text        -- actor role(s) at time of action
permission      text        -- permission that authorized it
module          text        -- e.g. 'transfers'
resource        text        -- e.g. 'transfer'
resource_id     text
reason          text        -- promoted out of details
request_id      text        -- correlation id (from middleware)
result          text        -- success|denied|error
before_summary  jsonb
after_summary   jsonb
```

`appendAuditEntry`/`appendCriticalAudit` gain optional typed fields; the legacy `appendAudit` shim continues to work (maps into the new columns where present, else `details`). **Never logged:** password, OTP, full session token, service-role key, SMTP password, OAuth refresh token, private key, CVV/PAN (enforced by a redaction allowlist in the audit writer).

---

## 10. Testing matrix (per privileged endpoint)

Every gated route is tested across five identities × expected outcome:

| Identity | Expected |
|---|---|
| Unauthenticated | 401 |
| Customer session | 401/403 (never reaches admin handler) |
| Wrong admin role (lacks perm) | 403 `PERMISSION_REQUIRED` |
| Correct role (has perm) | 2xx |
| SUPER_ADMIN | 2xx |

Plus: maker/checker rejection (approver == requester → 403), dual-approval happy path, fail-closed on unknown route (403), flag-vs-platformMode refusal, and audit-record assertions (reason/request_id/before/after present; secrets absent).

---

## 11. Open decisions for your sign-off

1. Approve the **6 extension permissions** (§2.2) or map them to fallbacks.
2. Confirm the **footnoted matrix choices** (§3 notes 1–7) — especially SECURITY_ADMIN's action-scoped `USERS_MANAGE` and OPERATIONS_ADMIN's `FEATURE_FLAGS_MANAGE`/`SYSTEM_MANAGE`.
3. Confirm **multi-role assignment** (an admin may hold several roles) vs single-role-per-admin.
4. Confirm **dual-approval action set** and thresholds (§7).
5. Confirm whether to **promote admin identity into `admin_users`** now, or keep the env-bootstrap SUPER_ADMIN and add managed admins alongside (recommended: both — env bootstrap remains the break-glass account).
