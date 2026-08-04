# City Gate Capital — API & Route Documentation

> Generated: 2026-07-20  
> Base URL: `https://citygate.capital`

## Table of Contents

1. [Frontend Page Routes](#frontend-page-routes)
2. [Public API Endpoints](#public-api-endpoints)
3. [Customer API Endpoints](#customer-api-endpoints)
4. [Admin API Endpoints](#admin-api-endpoints)
5. [Rate Limits](#rate-limits)
6. [Authentication](#authentication)

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

### Customer Auth Pages

| Route | Description | Auth |
|---|---|---|
| `GET /login` | Customer login | Public |
| `GET /dashboard` | Customer dashboard | Customer Auth |
| `GET /wallet` | Wallet & balances | Customer Auth |
| `GET /transfers` | Transfers & payments | Customer Auth |
| `GET /kyc` | KYC verification flow | Customer Auth |

### Admin Pages

| Route | Description | Auth |
|---|---|---|
| `GET /admin/login` | Admin login | Public |
| `GET /admin` | Admin dashboard | Admin Auth |
| `GET /admin/users` | User management | Admin Auth |
| `GET /admin/transactions` | Transaction management | Admin Auth |
| `GET /admin/security` | Security monitoring | Admin Auth |

## Public API Endpoints

| Route | Method | Description | Rate Limit |
|---|---|---|---|
| `/api/health` | GET | Server health check | Global 200/min |
| `/api/csrf` | GET | Get CSRF token | Global 200/min |
| `/api/contact` | POST | Submit contact form | 10/hr/IP |
| `/api/newsletter/subscribe` | POST | Subscribe to newsletter | 5/hr/IP |

## Authentication

### Customer Authentication
- **Cookie**: `cgc_customer_token` (HttpOnly, SameSite=Strict)
- **Header**: `Authorization: Bearer <token>`
- Session verified via `GET /api/users/session`

### Admin Authentication
- **Cookie**: `cgc_admin_sid` (HttpOnly, SameSite=Strict)
- **Header**: `Authorization: Bearer <token>`
- Session verified via `GET /api/admin/auth/verify`

### CSRF Protection
- Required on: `POST /api/contact`, `POST /api/accounts/apply`
- Token obtained from: `GET /api/csrf`
- Sent as: `X-CSRF-Token` header or `_csrf` body field