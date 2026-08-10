/**
 * GET /api/admin/developer
 * ─────────────────────────────────────────────────────────────────────────────
 * Developer Center data endpoint.
 * Returns 9 sections:
 *   routes · api_explorer · db_diagnostics · performance · dependencies
 *   error_monitor · build_info · deployment · env_validation
 *
 * No shell access. No arbitrary code execution.
 * Env values are masked — only status/presence is reported.
 */
import type { Request, Response } from 'express';
import fs   from 'node:fs';
import path from 'node:path';
import os   from 'node:os';
import { buildEnvReport } from '../../../lib/envValidator.js';

// ─── Route catalogue (static — derived from entry.ts registration) ────────────

const ROUTE_CATALOGUE: Array<{
  method: string; path: string; group: string; auth: string; description: string;
}> = [
  // Auth
  { method:'POST', path:'/api/admin/auth/login',                  group:'Admin Auth',       auth:'public',  description:'Admin login — bcrypt + session cookie' },
  { method:'POST', path:'/api/admin/auth/logout',                 group:'Admin Auth',       auth:'public',  description:'Destroy admin session' },
  { method:'GET',  path:'/api/admin/auth/verify',                 group:'Admin Auth',       auth:'public',  description:'Lightweight session check' },
  { method:'POST', path:'/api/admin/auth/otp/verify',             group:'Admin Auth',       auth:'public',  description:'TOTP second-factor verification' },
  { method:'POST', path:'/api/admin/auth/password-reset',         group:'Admin Auth',       auth:'public',  description:'Initiate admin password reset' },
  { method:'POST', path:'/api/admin/auth/password-reset/confirm', group:'Admin Auth',       auth:'public',  description:'Confirm admin password reset' },
  { method:'POST', path:'/api/admin/auth/unlock',                 group:'Admin Auth',       auth:'public',  description:'Unlock brute-force locked account' },
  { method:'GET',  path:'/api/admin/auth/trusted-devices',        group:'Admin Auth',       auth:'admin',   description:'List trusted devices for admin' },
  { method:'DELETE',path:'/api/admin/auth/trusted-devices',       group:'Admin Auth',       auth:'admin',   description:'Revoke a trusted device' },
  // Users
  { method:'GET',  path:'/api/admin/users',                       group:'Users',            auth:'admin',   description:'List customers with filters & pagination' },
  { method:'GET',  path:'/api/admin/users/:id',                   group:'Users',            auth:'admin',   description:'Minimal customer support profile' },
  { method:'POST', path:'/api/admin/users/create',                group:'Users',            auth:'admin',   description:'Create a new customer account' },
  { method:'POST', path:'/api/admin/users/action',                group:'Users',            auth:'admin',   description:'Bulk action on customers' },
  { method:'POST', path:'/api/admin/users/approve',               group:'Users',            auth:'admin',   description:'Approve a pending customer' },
  { method:'POST', path:'/api/admin/users/reject',                group:'Users',            auth:'admin',   description:'Reject a pending customer' },
  { method:'POST', path:'/api/admin/users/edit',                  group:'Users',            auth:'admin',   description:'Edit customer profile fields' },
  { method:'POST', path:'/api/admin/users/override',              group:'Users',            auth:'admin',   description:'Override customer status' },
  { method:'POST', path:'/api/admin/users/currency',              group:'Users',            auth:'admin',   description:'Set customer base currency' },
  { method:'POST', path:'/api/admin/users/delete',                group:'Users',            auth:'admin',   description:'Delete a customer account' },
  { method:'POST', path:'/api/admin/users/reset-password',        group:'Users',            auth:'admin',   description:'Force-reset customer password' },
  { method:'POST', path:'/api/admin/users/reset-2fa',             group:'Users',            auth:'admin',   description:'Reset customer 2FA' },
  { method:'GET',  path:'/api/admin/users/:id/devices',           group:'Users',            auth:'admin',   description:'Customer trusted devices' },
  { method:'GET',  path:'/api/admin/users/:id/login-history',     group:'Users',            auth:'admin',   description:'Customer login history' },
  { method:'GET',  path:'/api/admin/users/:id/security-events',   group:'Users',            auth:'admin',   description:'Customer security events' },
  { method:'GET',  path:'/api/admin/users/:id/audit',             group:'Users',            auth:'admin',   description:'Customer audit trail' },
  // KYC
  { method:'GET',  path:'/api/admin/kyc/queue',                   group:'KYC',              auth:'admin',   description:'KYC review queue' },
  { method:'GET',  path:'/api/admin/kyc/stats',                   group:'KYC',              auth:'admin',   description:'KYC statistics' },
  { method:'GET',  path:'/api/admin/kyc/settings',                group:'KYC',              auth:'admin',   description:'KYC settings' },
  { method:'POST', path:'/api/admin/kyc/settings',                group:'KYC',              auth:'admin',   description:'Update KYC settings' },
  { method:'POST', path:'/api/admin/kyc/approve',                 group:'KYC',              auth:'admin',   description:'Approve KYC submission' },
  { method:'POST', path:'/api/admin/kyc/reject',                  group:'KYC',              auth:'admin',   description:'Reject KYC submission' },
  { method:'POST', path:'/api/admin/kyc/flag',                    group:'KYC',              auth:'admin',   description:'Flag KYC for review' },
  { method:'POST', path:'/api/admin/kyc/note',                    group:'KYC',              auth:'admin',   description:'Add admin note to KYC' },
  { method:'POST', path:'/api/admin/kyc/extend',                  group:'KYC',              auth:'admin',   description:'Extend KYC expiry' },
  { method:'POST', path:'/api/admin/kyc/request-info',            group:'KYC',              auth:'admin',   description:'Request additional info from customer' },
  // Transactions
  { method:'GET',  path:'/api/admin/transactions',                group:'Transactions',     auth:'admin',   description:'List all transactions with filters' },
  { method:'GET',  path:'/api/admin/transactions/real',           group:'Transactions',     auth:'admin',   description:'Persisted application transaction records' },
  { method:'POST', path:'/api/admin/transactions/approve',        group:'Transactions',     auth:'admin',   description:'Approve a pending transaction' },
  { method:'POST', path:'/api/admin/transactions/reject',         group:'Transactions',     auth:'admin',   description:'Reject a pending transaction' },
  { method:'POST', path:'/api/admin/transactions/freeze',         group:'Transactions',     auth:'admin',   description:'Freeze a transaction' },
  { method:'POST', path:'/api/admin/transactions/create',         group:'Transactions',     auth:'admin',   description:'Create a manual transaction' },
  // Cards
  { method:'GET',  path:'/api/admin/cards',                       group:'Cards',            auth:'admin',   description:'List all virtual cards' },
  { method:'POST', path:'/api/admin/cards/issue',                 group:'Cards',            auth:'admin',   description:'Issue a new virtual card' },
  { method:'POST', path:'/api/admin/cards/freeze',                group:'Cards',            auth:'admin',   description:'Freeze/unfreeze a card' },
  { method:'POST', path:'/api/admin/cards/replace',               group:'Cards',            auth:'admin',   description:'Replace a card' },
  { method:'POST', path:'/api/admin/cards/spending-limit',        group:'Cards',            auth:'admin',   description:'Set card spending limit' },
  { method:'POST', path:'/api/admin/cards/pin',                   group:'Cards',            auth:'admin',   description:'Set card PIN' },
  { method:'GET',  path:'/api/admin/cards/:id/activity',          group:'Cards',            auth:'admin',   description:'Card activity log' },
  // Balance
  { method:'POST', path:'/api/admin/balance/adjust',              group:'Balance',          auth:'admin',   description:'Manual balance adjustment' },
  { method:'GET',  path:'/api/admin/balance/history',             group:'Balance',          auth:'admin',   description:'Balance adjustment history' },
  // Wallets
  { method:'GET',  path:'/api/admin/wallets',                     group:'Wallets',          auth:'admin',   description:'List all wallets' },
  { method:'PATCH',path:'/api/admin/wallets',                     group:'Wallets',          auth:'admin',   description:'Update wallet' },
  // Reports
  { method:'GET',  path:'/api/admin/reports',                     group:'Reports',          auth:'admin',   description:'11-type report engine (customers/txns/revenue/kyc/aml/…)' },
  // Trading administration (deferred; no live provider adapter)
  { method:'GET',  path:'/api/admin/trading/logs',                group:'Trading',          auth:'admin',   description:'Deferred trading administration action log' },
  // Security
  { method:'GET',  path:'/api/admin/security/sessions',           group:'Security',         auth:'admin',   description:'Active admin sessions' },
  { method:'GET',  path:'/api/admin/security/logs',               group:'Security',         auth:'admin',   description:'Persisted login event history' },
  { method:'PATCH',path:'/api/admin/security/sessions',           group:'Security',         auth:'admin',   description:'Revoke a session' },
  { method:'DELETE',path:'/api/admin/security/sessions',          group:'Security',         auth:'admin',   description:'Revoke all sessions' },
  { method:'GET',  path:'/api/admin/security/threats',            group:'Security',         auth:'admin',   description:'Threat intelligence feed' },
  { method:'PATCH',path:'/api/admin/security/threats',            group:'Security',         auth:'admin',   description:'Update threat status' },
  { method:'GET',  path:'/api/admin/security/alerts',             group:'Security',         auth:'admin',   description:'Security alerts' },
  { method:'POST', path:'/api/admin/security/alerts',             group:'Security',         auth:'admin',   description:'Create/update security alert' },
  { method:'GET',  path:'/api/admin/security/ip-lists',           group:'Security',         auth:'admin',   description:'IP allow/block lists' },
  { method:'POST', path:'/api/admin/security/ip-lists',           group:'Security',         auth:'admin',   description:'Update IP lists' },
  { method:'GET',  path:'/api/admin/security/rate-limits',        group:'Security',         auth:'admin',   description:'Rate limit configuration' },
  { method:'POST', path:'/api/admin/security/rate-limits',        group:'Security',         auth:'admin',   description:'Update rate limits' },
  { method:'GET',  path:'/api/admin/security/roles',              group:'Security',         auth:'admin',   description:'RBAC role definitions' },
  { method:'POST', path:'/api/admin/security/roles',              group:'Security',         auth:'admin',   description:'Update RBAC roles' },
  { method:'GET',  path:'/api/admin/security/devices',            group:'Security',         auth:'admin',   description:'All trusted devices' },
  { method:'DELETE',path:'/api/admin/security/devices',           group:'Security',         auth:'admin',   description:'Revoke a trusted device' },
  { method:'GET',  path:'/api/admin/security/two-fa',             group:'Security',         auth:'admin',   description:'2FA policy settings' },
  { method:'POST', path:'/api/admin/security/two-fa',             group:'Security',         auth:'admin',   description:'Update 2FA policy' },
  { method:'GET',  path:'/api/admin/security/export',             group:'Security',         auth:'admin',   description:'Export security data' },
  // Support
  { method:'GET',  path:'/api/admin/support',                     group:'Support',          auth:'admin',   description:'List support conversations' },
  { method:'POST', path:'/api/admin/support/reply',               group:'Support',          auth:'admin',   description:'Reply to a conversation' },
  { method:'POST', path:'/api/admin/support/status',              group:'Support',          auth:'admin',   description:'Update conversation status' },
  { method:'POST', path:'/api/admin/support/assign',              group:'Support',          auth:'admin',   description:'Assign conversation to agent' },
  { method:'POST', path:'/api/admin/support/priority',            group:'Support',          auth:'admin',   description:'Set conversation priority' },
  { method:'POST', path:'/api/admin/support/note',                group:'Support',          auth:'admin',   description:'Add internal note' },
  { method:'POST', path:'/api/admin/support/bulk',                group:'Support',          auth:'admin',   description:'Bulk action on conversations' },
  { method:'GET',  path:'/api/admin/support/canned',              group:'Support',          auth:'admin',   description:'Canned responses list' },
  { method:'POST', path:'/api/admin/support/canned',              group:'Support',          auth:'admin',   description:'Create canned response' },
  { method:'PUT',  path:'/api/admin/support/canned',              group:'Support',          auth:'admin',   description:'Update canned response' },
  { method:'DELETE',path:'/api/admin/support/canned',             group:'Support',          auth:'admin',   description:'Delete canned response' },
  { method:'GET',  path:'/api/admin/support/routing',             group:'Support',          auth:'admin',   description:'Auto-routing rules' },
  { method:'POST', path:'/api/admin/support/routing',             group:'Support',          auth:'admin',   description:'Update routing rules' },
  { method:'GET',  path:'/api/admin/support/notifications',       group:'Support',          auth:'admin',   description:'Notification settings' },
  { method:'POST', path:'/api/admin/support/notifications',       group:'Support',          auth:'admin',   description:'Update notification settings' },
  { method:'GET',  path:'/api/admin/support/stats',               group:'Support',          auth:'admin',   description:'Support statistics' },
  { method:'GET',  path:'/api/admin/support/messages',            group:'Support',          auth:'admin',   description:'Direct messages' },
  { method:'POST', path:'/api/admin/support/messages',            group:'Support',          auth:'admin',   description:'Send direct message' },
  { method:'GET',  path:'/api/admin/support/contact-forms',       group:'Support',          auth:'admin',   description:'Contact form submissions' },
  { method:'POST', path:'/api/admin/support/contact-forms',       group:'Support',          auth:'admin',   description:'Update contact form submission' },
  { method:'GET',  path:'/api/admin/support/feedback',            group:'Support',          auth:'admin',   description:'Customer feedback' },
  { method:'POST', path:'/api/admin/support/feedback',            group:'Support',          auth:'admin',   description:'Update feedback entry' },
  { method:'GET',  path:'/api/admin/support/complaints',          group:'Support',          auth:'admin',   description:'Formal complaints' },
  { method:'POST', path:'/api/admin/support/complaints',          group:'Support',          auth:'admin',   description:'Update complaint' },
  { method:'GET',  path:'/api/admin/support/announcements',       group:'Support',          auth:'admin',   description:'Platform announcements' },
  { method:'POST', path:'/api/admin/support/announcements',       group:'Support',          auth:'admin',   description:'Create/update announcement' },
  // Email
  { method:'GET',  path:'/api/admin/email/status',                group:'Email',            auth:'admin',   description:'Email transport status' },
  { method:'GET',  path:'/api/admin/email/queue',                 group:'Email',            auth:'admin',   description:'Email queue' },
  { method:'POST', path:'/api/admin/email/queue/retry',           group:'Email',            auth:'admin',   description:'Retry failed emails' },
  { method:'DELETE',path:'/api/admin/email/queue/:id',            group:'Email',            auth:'admin',   description:'Delete queued email' },
  { method:'POST', path:'/api/admin/email/flush',                 group:'Email',            auth:'admin',   description:'Flush email queue' },
  { method:'POST', path:'/api/admin/email/purge',                 group:'Email',            auth:'admin',   description:'Purge email queue' },
  { method:'POST', path:'/api/admin/email/requeue',               group:'Email',            auth:'admin',   description:'Requeue failed emails' },
  { method:'GET',  path:'/api/admin/email/log',                   group:'Email',            auth:'admin',   description:'Email send log' },
  { method:'GET',  path:'/api/admin/email/templates',             group:'Email',            auth:'admin',   description:'Email templates' },
  { method:'POST', path:'/api/admin/email/templates',             group:'Email',            auth:'admin',   description:'Update email template' },
  { method:'POST', path:'/api/admin/email/templates/reset',       group:'Email',            auth:'admin',   description:'Reset template to default' },
  { method:'POST', path:'/api/admin/email/test',                  group:'Email',            auth:'admin',   description:'Send test email' },
  // SMTP
  { method:'GET',  path:'/api/admin/smtp/config',                 group:'SMTP',             auth:'admin',   description:'SMTP configuration' },
  { method:'POST', path:'/api/admin/smtp/config',                 group:'SMTP',             auth:'admin',   description:'Update SMTP config' },
  { method:'POST', path:'/api/admin/smtp/mode',                   group:'SMTP',             auth:'admin',   description:'Switch SMTP mode (oauth/smtp)' },
  { method:'GET',  path:'/api/admin/smtp/status',                 group:'SMTP',             auth:'admin',   description:'SMTP transport status' },
  { method:'POST', path:'/api/admin/smtp/test',                   group:'SMTP',             auth:'admin',   description:'Send SMTP test' },
  { method:'POST', path:'/api/admin/smtp/verify',                 group:'SMTP',             auth:'admin',   description:'Verify SMTP credentials' },
  // Rates
  { method:'GET',  path:'/api/admin/rates',                       group:'Rates',            auth:'admin',   description:'Exchange rates & fee matrix' },
  { method:'POST', path:'/api/admin/rates/tx-fees',               group:'Rates',            auth:'admin',   description:'Update transaction fees' },
  { method:'POST', path:'/api/admin/rates/fx-markup',             group:'Rates',            auth:'admin',   description:'Update FX markup' },
  { method:'POST', path:'/api/admin/rates/tier-fees',             group:'Rates',            auth:'admin',   description:'Update tier-based fees' },
  { method:'POST', path:'/api/admin/rates/limits',                group:'Rates',            auth:'admin',   description:'Update transaction limits' },
  { method:'GET',  path:'/api/admin/rates/limits/user',           group:'Rates',            auth:'admin',   description:'Per-user limits' },
  { method:'GET',  path:'/api/admin/rates/fee-history',           group:'Rates',            auth:'admin',   description:'Fee change history' },
  // Config
  { method:'GET',  path:'/api/admin/config',                      group:'Config',           auth:'admin',   description:'Platform configuration (12 sections)' },
  { method:'POST', path:'/api/admin/config',                      group:'Config',           auth:'admin',   description:'Update configuration section' },
  // CMS
  { method:'GET',  path:'/api/admin/cms',                         group:'CMS',              auth:'admin',   description:'CMS content' },
  { method:'POST', path:'/api/admin/cms',                         group:'CMS',              auth:'admin',   description:'Update CMS content' },
  { method:'GET',  path:'/api/admin/cms/hero',                    group:'CMS',              auth:'admin',   description:'Hero section content' },
  { method:'POST', path:'/api/admin/cms/hero',                    group:'CMS',              auth:'admin',   description:'Update hero section' },
  { method:'GET',  path:'/api/admin/cms/logo',                    group:'CMS',              auth:'admin',   description:'Logo settings' },
  { method:'POST', path:'/api/admin/cms/logo',                    group:'CMS',              auth:'admin',   description:'Update logo' },
  { method:'GET',  path:'/api/admin/cms/navigation',              group:'CMS',              auth:'admin',   description:'Navigation structure' },
  { method:'POST', path:'/api/admin/cms/navigation',              group:'CMS',              auth:'admin',   description:'Update navigation' },
  { method:'GET',  path:'/api/admin/cms/features',                group:'CMS',              auth:'admin',   description:'Features section' },
  { method:'POST', path:'/api/admin/cms/features',                group:'CMS',              auth:'admin',   description:'Update features' },
  { method:'GET',  path:'/api/admin/cms/news',                    group:'CMS',              auth:'admin',   description:'News items' },
  { method:'POST', path:'/api/admin/cms/news',                    group:'CMS',              auth:'admin',   description:'Update news' },
  { method:'GET',  path:'/api/admin/cms/blog',                    group:'CMS',              auth:'admin',   description:'Blog posts' },
  { method:'POST', path:'/api/admin/cms/blog',                    group:'CMS',              auth:'admin',   description:'Update blog' },
  // Media
  { method:'GET',  path:'/api/admin/media',                       group:'Media',            auth:'admin',   description:'Media library list' },
  { method:'POST', path:'/api/admin/media',                       group:'Media',            auth:'admin',   description:'Upload media file' },
  { method:'POST', path:'/api/admin/media/replace',               group:'Media',            auth:'admin',   description:'Replace media file' },
  // Audit
  { method:'GET',  path:'/api/admin/audit',                       group:'Audit',            auth:'admin',   description:'Paginated audit log' },
  // Stats / Health
  { method:'GET',  path:'/api/admin/stats',                       group:'Platform',         auth:'admin',   description:'Executive dashboard KPIs' },
  { method:'GET',  path:'/api/admin/health',                      group:'Platform',         auth:'admin',   description:'System health check' },
  { method:'GET',  path:'/api/admin/readiness',                   group:'Platform',         auth:'admin',   description:'Deployment readiness checks' },
  { method:'GET',  path:'/api/admin/env-report',                  group:'Platform',         auth:'admin',   description:'Environment variable status report' },
  { method:'GET',  path:'/api/admin/developer',                   group:'Platform',         auth:'admin',   description:'Developer Center data' },
  { method:'GET',  path:'/api/admin/documentation/:format',       group:'Platform',         auth:'admin',   description:'Protected API reference snapshot download' },
  // Newsletter
  { method:'GET',  path:'/api/admin/newsletter/campaigns',        group:'Newsletter',       auth:'admin',   description:'Campaign list' },
  { method:'POST', path:'/api/admin/newsletter/campaigns',        group:'Newsletter',       auth:'admin',   description:'Create campaign' },
  { method:'PUT',  path:'/api/admin/newsletter/campaigns',        group:'Newsletter',       auth:'admin',   description:'Update campaign' },
  { method:'POST', path:'/api/admin/newsletter/campaigns/send',   group:'Newsletter',       auth:'admin',   description:'Send campaign' },
  { method:'POST', path:'/api/admin/newsletter/campaigns/duplicate', group:'Newsletter',    auth:'admin',   description:'Duplicate campaign' },
  // Integrations
  { method:'GET',  path:'/api/admin/integrations',                group:'Integrations',     auth:'admin',   description:'Integration configurations' },
  { method:'POST', path:'/api/admin/integrations',                group:'Integrations',     auth:'admin',   description:'Update integration' },
  { method:'POST', path:'/api/admin/integrations/test',           group:'Integrations',     auth:'admin',   description:'Test integration connection' },
  // Chatbot
  { method:'GET',  path:'/api/admin/chatbot',                     group:'Chatbot',          auth:'admin',   description:'Chatbot configuration' },
  { method:'POST', path:'/api/admin/chatbot',                     group:'Chatbot',          auth:'admin',   description:'Update chatbot config' },
  // Public API
  { method:'GET',  path:'/api/health',                            group:'Public',           auth:'public',  description:'Public health check' },
  { method:'GET',  path:'/api/csrf',                              group:'Public',           auth:'public',  description:'CSRF token' },
  { method:'POST', path:'/api/contact',                           group:'Public',           auth:'public',  description:'Contact form submission' },
  { method:'POST', path:'/api/newsletter/subscribe',              group:'Public',           auth:'public',  description:'Newsletter subscription' },
  { method:'GET',  path:'/api/newsletter/unsubscribe',            group:'Public',           auth:'public',  description:'Newsletter unsubscribe' },
  { method:'POST', path:'/api/users/register',                    group:'Customer Auth',    auth:'public',  description:'Customer registration' },
  { method:'POST', path:'/api/users/login',                       group:'Customer Auth',    auth:'public',  description:'Customer login' },
  { method:'POST', path:'/api/users/logout',                      group:'Customer Auth',    auth:'public',  description:'Customer logout' },
  { method:'GET',  path:'/api/users/session',                     group:'Customer Auth',    auth:'customer',description:'Customer session check' },
  { method:'POST', path:'/api/users/password-reset',              group:'Customer Auth',    auth:'public',  description:'Initiate password reset' },
  { method:'POST', path:'/api/users/password-reset/confirm',      group:'Customer Auth',    auth:'public',  description:'Confirm password reset' },
  { method:'GET',  path:'/api/users/verify-email',                group:'Customer Auth',    auth:'public',  description:'Email verification' },
  { method:'GET',  path:'/api/users/balance',                     group:'Customer',         auth:'customer',description:'Customer balance' },
  { method:'GET',  path:'/api/users/transactions',                group:'Customer',         auth:'customer',description:'Customer transaction history' },
  { method:'POST', path:'/api/users/deposit',                     group:'Customer',         auth:'customer',description:'Initiate deposit' },
  { method:'POST', path:'/api/users/withdraw',                    group:'Customer',         auth:'customer',description:'Initiate withdrawal' },
  { method:'POST', path:'/api/users/transfer',                    group:'Customer',         auth:'customer',description:'Internal transfer' },
  { method:'POST', path:'/api/users/swap',                        group:'Customer',         auth:'customer',description:'Crypto swap' },
  { method:'GET',  path:'/api/users/cards',                       group:'Customer',         auth:'customer',description:'Customer virtual cards' },
  { method:'POST', path:'/api/users/cards/generate',              group:'Customer',         auth:'customer',description:'Generate virtual card' },
  { method:'POST', path:'/api/users/cards/freeze',                group:'Customer',         auth:'customer',description:'Freeze/unfreeze card' },
  { method:'POST', path:'/api/users/cards/delete',                group:'Customer',         auth:'customer',description:'Delete card' },
  { method:'PATCH',path:'/api/users/me',                          group:'Customer',         auth:'customer',description:'Update customer profile' },
  { method:'POST', path:'/api/users/avatar',                      group:'Customer',         auth:'customer',description:'Upload avatar' },
  { method:'POST', path:'/api/users/kyc-document',                group:'Customer',         auth:'customer',description:'Submit KYC document' },
  { method:'GET',  path:'/api/users/notifications',               group:'Customer',         auth:'customer',description:'Customer notifications' },
  { method:'POST', path:'/api/users/notifications/read',          group:'Customer',         auth:'customer',description:'Mark notifications read' },
  { method:'GET',  path:'/api/users/support',                     group:'Customer',         auth:'customer',description:'Customer support tickets' },
  { method:'POST', path:'/api/users/support',                     group:'Customer',         auth:'customer',description:'Create support ticket' },
  { method:'GET',  path:'/api/settings/rates',                    group:'Public',           auth:'public',  description:'Public exchange rates' },
  { method:'GET',  path:'/api/settings/social',                   group:'Public',           auth:'public',  description:'Social media links' },
  { method:'GET',  path:'/api/analytics/summary',                 group:'Analytics',        auth:'admin',   description:'Analytics summary' },
  { method:'POST', path:'/api/analytics/event',                   group:'Analytics',        auth:'public',  description:'Track analytics event' },
  { method:'GET',  path:'/api/analytics/conversions',             group:'Analytics',        auth:'admin',   description:'Conversion funnel data' },
  { method:'GET',  path:'/api/analytics/ab-results',             group:'Analytics',        auth:'admin',   description:'A/B test results' },
  { method:'GET',  path:'/api/zoho/connect',                      group:'Zoho OAuth',       auth:'admin',   description:'Initiate Zoho OAuth flow' },
  { method:'GET',  path:'/api/zoho/callback',                     group:'Zoho OAuth',       auth:'public',  description:'Zoho OAuth callback' },
  { method:'GET',  path:'/api/zoho/status',                       group:'Zoho OAuth',       auth:'admin',   description:'Zoho token status' },
  { method:'POST', path:'/api/admin/zoho/exchange',               group:'Zoho OAuth',       auth:'admin',   description:'Exchange Zoho auth code' },
];

// ─── DB diagnostics ───────────────────────────────────────────────────────────

interface DbFile {
  name: string; path: string; type: 'jsonl' | 'json';
  rows: number; sizeBytes: number; lastModified: string; healthy: boolean; error?: string;
}

function scanDbFiles(): DbFile[] {
  const KNOWN: Array<{ name: string; path: string; type: 'jsonl' | 'json' }> = [
    { name: 'Users',           path: '/private/users/users.jsonl',                type: 'jsonl' },
    { name: 'Transactions',    path: '/private/transactions/transactions.jsonl',  type: 'jsonl' },
    { name: 'Balance Txns',    path: '/private/balance/transactions.jsonl',       type: 'jsonl' },
    { name: 'Cards',           path: '/private/cards/cards.jsonl',                type: 'jsonl' },
    { name: 'Wallets',         path: '/private/wallets/addresses.jsonl',          type: 'jsonl' },
    { name: 'Support Convs',   path: '/private/support/conversations.jsonl',      type: 'jsonl' },
    { name: 'Notifications',   path: '/private/notifications/notifications.jsonl',type: 'jsonl' },
    { name: 'Newsletter Subs', path: '/private/newsletter/subscribers.jsonl',     type: 'jsonl' },
    { name: 'Newsletter Log',  path: '/private/newsletter/sent-log.jsonl',        type: 'jsonl' },
    { name: 'Security Flags',  path: '/private/security/flags.jsonl',             type: 'jsonl' },
    { name: 'Email Queue',     path: '/private/email/queue.jsonl',                type: 'jsonl' },
    { name: 'Email Logs',      path: '/private/email/logs.jsonl',                 type: 'jsonl' },
    { name: 'Audit Log',       path: '/private/admin/audit.jsonl',                type: 'jsonl' },
    { name: 'Audit (legacy)',  path: '/private/audit/log.jsonl',                  type: 'jsonl' },
    { name: 'Analytics Events',path: '/private/analytics/events.jsonl',           type: 'jsonl' },
    { name: 'Access Log',      path: '/private/logs/access.jsonl',                type: 'jsonl' },
    { name: 'Login Log',       path: '/private/logs/login.jsonl',                 type: 'jsonl' },
    { name: 'Threats Log',     path: '/private/logs/threats.jsonl',               type: 'jsonl' },
    { name: 'Fee History',     path: '/private/cms/fee-history.jsonl',            type: 'jsonl' },
    { name: 'App Config',      path: '/private/app_config.json',                  type: 'json'  },
    { name: 'KYC Settings',    path: '/private/kyc/settings.json',                type: 'json'  },
    { name: 'SMTP Config',     path: '/private/smtp/config.json',                 type: 'json'  },
    { name: 'Security IP Lists',path: '/private/security/ip-lists.json',          type: 'json'  },
    { name: 'Security 2FA',    path: '/private/security/2fa-policy.json',         type: 'json'  },
    { name: 'Security Flags Config', path: '/private/security/flag-rules.json',   type: 'json'  },
  ];

  return KNOWN.map(f => {
    try {
      if (!fs.existsSync(f.path)) return { ...f, rows: 0, sizeBytes: 0, lastModified: '', healthy: false, error: 'File not found' };
      const stat = fs.statSync(f.path);
      let rows = 0;
      let healthy = true;
      let error: string | undefined;
      if (f.type === 'jsonl') {
        const content = fs.readFileSync(f.path, 'utf8');
        const lines   = content.split('\n').filter(Boolean);
        rows = lines.length;
        // Validate last line is valid JSON
        if (lines.length > 0) {
          try { JSON.parse(lines[lines.length - 1]); } catch { healthy = false; error = 'Last line is invalid JSON'; }
        }
      } else {
        try { JSON.parse(fs.readFileSync(f.path, 'utf8')); rows = 1; } catch { healthy = false; error = 'Invalid JSON'; }
      }
      return { ...f, rows, sizeBytes: stat.size, lastModified: stat.mtime.toISOString(), healthy, error };
    } catch (e) {
      return { ...f, rows: 0, sizeBytes: 0, lastModified: '', healthy: false, error: String(e) };
    }
  });
}

// ─── Performance metrics ──────────────────────────────────────────────────────

function getPerformanceMetrics() {
  const mem   = process.memoryUsage();
  const cpus  = os.cpus();
  const uptime = process.uptime();

  // Compute CPU usage from os.loadavg (1-min average)
  const loadAvg = os.loadavg();

  return {
    uptime:          Math.floor(uptime),
    uptimeHuman:     formatUptime(uptime),
    memoryUsed:      mem.heapUsed,
    memoryTotal:     mem.heapTotal,
    memoryRss:       mem.rss,
    memoryExternal:  mem.external,
    memoryPct:       +((mem.heapUsed / mem.heapTotal) * 100).toFixed(1),
    cpuCount:        cpus.length,
    cpuModel:        cpus[0]?.model ?? 'Unknown',
    loadAvg1m:       +loadAvg[0].toFixed(2),
    loadAvg5m:       +loadAvg[1].toFixed(2),
    loadAvg15m:      +loadAvg[2].toFixed(2),
    nodeVersion:     process.version,
    platform:        process.platform,
    arch:            process.arch,
    pid:             process.pid,
    freeMem:         os.freemem(),
    totalMem:        os.totalmem(),
    hostname:        os.hostname(),
  };
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

// ─── Dependency health ────────────────────────────────────────────────────────

function getDependencyHealth() {
  const PKG_PATH = path.resolve(process.cwd(), 'package.json');
  let deps: Record<string, string> = {};
  let devDeps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    deps    = pkg.dependencies    ?? {};
    devDeps = pkg.devDependencies ?? {};
  } catch { /* silent */ }

  // Key runtime deps to highlight
  const KEY_DEPS = [
    'express','react','react-dom','react-router-dom','motion',
    'bcryptjs','nodemailer','zod','@tanstack/react-query',
    'lucide-react','tailwindcss','vite','typescript',
  ];

  const all = { ...deps, ...devDeps };
  const keyDeps = KEY_DEPS.map(name => ({
    name,
    version: all[name] ?? 'not installed',
    isDev: name in devDeps,
    present: name in all,
  }));

  return {
    totalDeps:    Object.keys(deps).length,
    totalDevDeps: Object.keys(devDeps).length,
    keyDeps,
    runtimeDeps:  Object.entries(deps).map(([name, version]) => ({ name, version })),
  };
}

// ─── Error monitor ────────────────────────────────────────────────────────────

function getErrorMonitor() {
  // Read recent threat/error entries from logs
  const THREATS_FILE = '/private/logs/threats.jsonl';
  const ACCESS_FILE  = '/private/logs/access.jsonl';

  let recentErrors: Array<{ ts: string; type: string; detail: string; ip?: string }> = [];
  let http5xx = 0;
  let http4xx = 0;
  let totalRequests = 0;

  try {
    if (fs.existsSync(THREATS_FILE)) {
      const lines = fs.readFileSync(THREATS_FILE, 'utf8').split('\n').filter(Boolean);
      recentErrors = lines.slice(-50).map(l => {
        try {
          const e = JSON.parse(l);
          return { ts: e.ts ?? e.timestamp ?? '', type: e.type ?? 'threat', detail: e.detail ?? e.message ?? '', ip: e.ip };
        } catch { return { ts: '', type: 'parse_error', detail: l.slice(0, 100) }; }
      }).reverse();
    }
  } catch { /* silent */ }

  try {
    if (fs.existsSync(ACCESS_FILE)) {
      const lines = fs.readFileSync(ACCESS_FILE, 'utf8').split('\n').filter(Boolean);
      totalRequests = lines.length;
      for (const l of lines.slice(-5000)) {
        try {
          const e = JSON.parse(l);
          const status = Number(e.status ?? e.statusCode ?? 200);
          if (status >= 500) http5xx++;
          else if (status >= 400) http4xx++;
        } catch { /* skip */ }
      }
    }
  } catch { /* silent */ }

  return {
    recentErrors: recentErrors.slice(0, 20),
    http5xx,
    http4xx,
    totalRequests,
    errorRate: totalRequests > 0 ? +((http5xx / Math.min(totalRequests, 5000)) * 100).toFixed(2) : 0,
  };
}

// ─── Build information ────────────────────────────────────────────────────────

function getBuildInfo() {
  const PKG_PATH = path.resolve(process.cwd(), 'package.json');
  let name = 'city-gate-capital';
  let version = '1.0.0';
  let scripts: Record<string, string> = {};
  try {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    name    = pkg.name    ?? name;
    version = pkg.version ?? version;
    scripts = pkg.scripts ?? {};
  } catch { /* silent */ }

  // Check if dist exists (built)
  const distExists   = fs.existsSync(path.resolve(process.cwd(), 'dist'));
  const distClient   = fs.existsSync(path.resolve(process.cwd(), 'dist/client'));
  const distServer   = fs.existsSync(path.resolve(process.cwd(), 'dist/server.bundle.mjs'));

  // Source file counts
  let srcFileCount = 0;
  let srcPageCount = 0;
  let srcApiCount  = 0;
  try {
    const countFiles = (dir: string, ext: string): number => {
      if (!fs.existsSync(dir)) return 0;
      let count = 0;
      const walk = (d: string) => {
        for (const f of fs.readdirSync(d)) {
          const full = path.join(d, f);
          if (fs.statSync(full).isDirectory()) walk(full);
          else if (f.endsWith(ext)) count++;
        }
      };
      walk(dir);
      return count;
    };
    srcFileCount = countFiles(path.resolve(process.cwd(), 'src'), '.tsx') +
                  countFiles(path.resolve(process.cwd(), 'src'), '.ts');
    srcPageCount = countFiles(path.resolve(process.cwd(), 'src/pages'), '.tsx');
    srcApiCount  = countFiles(path.resolve(process.cwd(), 'src/server/api'), '.ts');
  } catch { /* silent */ }

  return {
    name,
    version,
    nodeVersion:   process.version,
    environment:   process.env.NODE_ENV ?? 'development',
    distExists,
    distClient,
    distServer,
    srcFileCount,
    srcPageCount,
    srcApiCount,
    totalRoutes:   ROUTE_CATALOGUE.length,
    scripts: Object.entries(scripts).map(([k, v]) => ({ name: k, command: v })),
    buildCommand:  scripts.build ?? 'npm run build',
    startCommand:  scripts.start ?? 'npm start',
  };
}

// ─── Deployment information ───────────────────────────────────────────────────

function getDeploymentInfo() {
  return {
    environment:   process.env.NODE_ENV ?? 'development',
    appEnv:        process.env.APP_ENV  ?? process.env.NODE_ENV ?? 'development',
    port:          process.env.PORT     ?? '3000',
    host:          os.hostname(),
    platform:      process.platform,
    arch:          process.arch,
    nodeVersion:   process.version,
    pid:           process.pid,
    startedAt:     new Date(Date.now() - process.uptime() * 1000).toISOString(),
    uptime:        Math.floor(process.uptime()),
    uptimeHuman:   formatUptime(process.uptime()),
    previewUrl:    'https://yxhof1orqw.preview.c24.airoapp.ai',
    productionUrl: 'https://citygate.capital',
    // Storage paths
    privatePath:   '/private',
    publicPath:    '/shared-storage/public/assets',
    privateExists: fs.existsSync('/private'),
    publicExists:  fs.existsSync('/shared-storage/public/assets'),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(_req: Request, res: Response) {
  try {
    const [perf, deps, errors, build, deploy, dbFiles, envReport] = await Promise.all([
      Promise.resolve(getPerformanceMetrics()),
      Promise.resolve(getDependencyHealth()),
      Promise.resolve(getErrorMonitor()),
      Promise.resolve(getBuildInfo()),
      Promise.resolve(getDeploymentInfo()),
      Promise.resolve(scanDbFiles()),
      Promise.resolve(buildEnvReport()),
    ]);

    // Route stats
    const routeGroups: Record<string, number> = {};
    const routeMethods: Record<string, number> = {};
    for (const r of ROUTE_CATALOGUE) {
      routeGroups[r.group]   = (routeGroups[r.group]   ?? 0) + 1;
      routeMethods[r.method] = (routeMethods[r.method] ?? 0) + 1;
    }

    res.json({
      generatedAt: new Date().toISOString(),
      routes: {
        total:      ROUTE_CATALOGUE.length,
        byGroup:    routeGroups,
        byMethod:   routeMethods,
        catalogue:  ROUTE_CATALOGUE,
      },
      db: {
        files:      dbFiles,
        totalFiles: dbFiles.length,
        healthy:    dbFiles.filter(f => f.healthy).length,
        unhealthy:  dbFiles.filter(f => !f.healthy).length,
        totalRows:  dbFiles.reduce((s, f) => s + f.rows, 0),
        totalBytes: dbFiles.reduce((s, f) => s + f.sizeBytes, 0),
      },
      performance: perf,
      dependencies: deps,
      errors,
      build,
      deployment: deploy,
      env: {
        summary:   envReport.summary,
        variables: envReport.variables,
      },
    });
  } catch (err) {
    console.error('[developer]', err);
    res.status(500).json({ error: 'Developer data collection failed', message: String(err) });
  }
}
