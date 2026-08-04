# City Gate Capital — API & Route Documentation

> Generated: 2026-06-04  
> Base URL: `https://citygate.capital`

---

## Table of Contents

1. [Frontend Page Routes](#frontend-page-routes)
2. [Public API Endpoints](#public-api-endpoints)
3. [Customer API Endpoints](#customer-api-endpoints)
4. [Admin API Endpoints](#admin-api-endpoints)
5. [Rate Limits](#rate-limits)
6. [Authentication](#authentication)

---

## Frontend Page Routes

### Public Pages

| Route | Description | Auth |
|---|---|---|
| `GET /` | Homepage | Public |
| `GET /about` | About City Gate Capital | Public |
| `GET /digital-banking` | Digital banking feature page | Public |
| `GET /accounts` | Account types & pricing | Public |
| `GET /support` | Help & support centre | Public |
| `GET /contact` | Contact page | Public |
| `GET /privacy-policy` | Privacy policy | Public |
| `GET /terms-of-service` | Terms of service | Public |
| `GET /cookie-policy` | Cookie policy | Public |
| `GET /compliance` | Compliance & regulation | Public |

### Customer Auth Pages

| Route | Description | Auth |
|---|---|---|
| `GET /login` | Customer login | Public |
| `GET /register` | Customer registration | Public |
| `GET /forgot-password` | Password reset request | Public |
| `GET /reset-password` | Password reset (token in query) | Public |
| `GET /dashboard` | Customer dashboard | Customer Auth |
| `GET /wallet` | Wallet & balances | Customer Auth |
| `GET /transfers` | Transfers & payments | Customer Auth |
| `GET /kyc` | KYC verification flow | Customer Auth |

### Admin Pages

| Route | Description | Auth |
|---|---|---|
| `GET /admin/login` | Admin login | Public |
| `GET /admin/forgot-password` | Admin password reset request | Public |
| `GET /admin/reset-password` | Admin password reset (token in query) | Public |
| `GET /admin` | Admin dashboard | Admin Auth |
| `GET /admin/users` | User management | Admin Auth |
| `GET /admin/transactions` | Transaction management | Admin Auth |
| `GET /admin/banking` | Banking operations | Admin Auth |
| `GET /admin/crypto` | Crypto wallet management | Admin Auth |
| `GET /admin/kyc` | KYC review queue | Admin Auth |
| `GET /admin/support` | Support ticket management | Admin Auth |
| `GET /admin/security` | Security monitoring | Admin Auth |
| `GET /admin/rates` | Exchange rates & fees | Admin Auth |
| `GET /admin/cms` | Content management | Admin Auth |
| `GET /admin/newsletter` | Newsletter management | Admin Auth |
| `GET /admin/smtp` | SMTP / email configuration | Admin Auth |
| `GET /admin/contacts` | Contact form submissions | Admin Auth |
| `GET /admin/social` | Social media settings | Admin Auth |
| `GET /admin/chatbot` | Chatbot configuration | Admin Auth |
| `GET /admin/links` | External links management | Admin Auth |
| `GET /admin/website` | Website settings | Admin Auth |
| `GET /admin/settings` | Admin settings | Admin Auth |
| `GET /admin/documentation` | API documentation downloads | Admin Auth |

---

## Public API Endpoints

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/health` | GET | Server health check | Public | Global 200/min |
| `/api/csrf` | GET | Get CSRF token | Public | Global 200/min |
| `/api/og` | GET | Open Graph image generator | Public | Global 200/min |
| `/api/cms/content` | GET | Public CMS content (60s cache) | Public | Global 200/min |
| `/api/settings/rates` | GET | Public exchange rates & fees | Public | Global 200/min |
| `/api/settings/social` | GET | Public social media links | Public | Global 200/min |
| `/api/contact` | POST | Submit contact form | Public | 10/hr/IP |
| `/api/newsletter/subscribe` | POST | Subscribe to newsletter | Public | 5/hr/IP |
| `/api/newsletter/unsubscribe` | GET | Unsubscribe from newsletter | Public | Global 200/min |
| `/api/accounts/apply` | POST | Submit account application | Public | 3/hr/IP |
| `/api/analytics/event` | POST | Track analytics event (telemetry) | Public | Global 200/min |
| `/unsubscribe` | GET | Newsletter unsubscribe (alias) | Public | Global 200/min |
| `/robots.txt` | GET | Robots.txt | Public | — |
| `/sitemap.xml` | GET | XML sitemap | Public | — |

---

## Customer API Endpoints

All customer endpoints require a valid customer session cookie (`cgc_customer_token`).

### Authentication

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/users/register` | POST | Register new customer account | Public | 5/hr/IP |
| `/api/users/verify-email` | GET | Verify email address (token in query) | Public | Global 200/min |
| `/api/users/login` | POST | Customer login | Public | 5/15min/IP |
| `/api/users/session` | GET | Get current session / verify token | Customer Auth | Global 200/min |
| `/api/users/logout` | POST | Logout customer | Customer Auth | Global 200/min |
| `/api/users/password-reset` | POST | Request password reset email | Public | 5/15min/IP |
| `/api/users/password-reset/confirm` | POST | Confirm password reset with token | Public | 5/15min/IP |

---

## Admin API Endpoints

All admin endpoints (except auth) require a valid admin session. Auth is resolved from HttpOnly cookie `cgc_admin_sid` OR `Authorization: Bearer <token>` header.

### Admin Authentication (Public — no session required)

| Route | Method | Description | Rate Limit |
|---|---|---|---|
| `/api/admin/auth/login` | POST | Admin login (password) | 5/15min/IP |
| `/api/admin/auth/otp/verify` | POST | Verify OTP / 2FA code | 5/15min/IP |
| `/api/admin/auth/password-reset` | POST | Request admin password reset | 3/15min/IP |
| `/api/admin/auth/password-reset/confirm` | POST | Confirm admin password reset | 5/15min/IP |
| `/api/admin/auth/verify` | GET | Verify existing admin session | Global 200/min |
| `/api/admin/auth/logout` | POST | Logout admin session | Global 200/min |

---

## Rate Limits

| Limit Key | Window | Max Requests | Applied To |
|---|---|---|---|
| Global API | 1 min | 200/IP | All `/api/*` routes |
| Auth | 15 min | 5/IP | Login, session verify |
| Admin password reset | 15 min | 3/IP | `/api/admin/auth/password-reset` |
| Admin reset confirm | 15 min | 5/IP | `/api/admin/auth/password-reset/confirm` |
| Registration | 1 hr | 5/IP | `/api/users/register` |
| Contact form | 1 hr | 10/IP | `/api/contact` |
| Newsletter subscribe | 1 hr | 5/IP | `/api/newsletter/subscribe` |
| Account application | 1 hr | 3/IP | `/api/accounts/apply` |
| Test email | 1 hr | 10/IP | `/api/test-email` |

---

## Authentication

### Customer Authentication
- **Cookie**: `cgc_customer_token` (HttpOnly, SameSite=Strict)
- **Header**: `Authorization: Bearer <token>`
- Session verified via `GET /api/users/session`

### Admin Authentication
- **Cookie**: `cgc_admin_sid` (HttpOnly, SameSite=Strict)
- **Header**: `Authorization: Bearer <token>`
- Session verified via `GET /api/admin/auth/verify`
- Enforces IP + User-Agent fingerprinting, inactivity TTL, and absolute TTL
- Optional OTP / 2FA via `POST /api/admin/auth/otp/verify`

### CSRF Protection
- Required on: `POST /api/contact`, `POST /api/accounts/apply`
- Token obtained from: `GET /api/csrf`
- Sent as: `X-CSRF-Token` header or `_csrf` body field