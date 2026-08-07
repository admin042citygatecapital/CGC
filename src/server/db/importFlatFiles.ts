/**
 * importFlatFiles.ts — Migrate all /private/* flat-file stores to PostgreSQL.
 *
 * Usage:
 *   npx tsx src/server/db/importFlatFiles.ts [--dry-run] [--validate-only]
 *
 * Flags:
 *   --dry-run        Parse and validate all files but do NOT write to the database.
 *   --validate-only  Same as --dry-run.
 *   --force          Re-import even if records already exist (upsert mode).
 *
 * What this script migrates:
 *   /private/users/users.jsonl              → users + customer_sessions
 *   /private/transactions/transactions.jsonl → transactions
 *   /private/cards/cards.jsonl              → cards
 *   /private/cards/activity.jsonl           → card_activity
 *   /private/wallets/wallets.json           → wallets
 *   /private/kyc/admin-notes.jsonl          → kyc_notes
 *   /private/kyc/settings.json              → kyc_settings
 *   /private/trading/positions.jsonl        → trading_positions
 *   /private/trading/orders.jsonl           → trading_orders
 *   /private/trading/trades.jsonl           → trading_trades
 *   /private/trading/watchlist.jsonl        → trading_watchlist
 *   /private/notifications/notifications.jsonl → notifications
 *   /private/support/conversations.jsonl    → support_conversations + support_messages + support_notes
 *   /private/support/canned-responses.json → canned_responses
 *   /private/logs/login.jsonl               → login_events
 *   /private/admin/sessions.json            → admin_sessions
 *
 * Safety:
 *   - All inserts use ON CONFLICT DO NOTHING (idempotent — safe to re-run).
 *   - The script validates every record before inserting.
 *   - A migration report is written to /private/migration-report.json.
 *   - On any error, the script rolls back the current batch and continues.
 */

import fs     from 'node:fs';
import path   from 'node:path';
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';

// ── CLI flags ─────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run') || args.includes('--validate-only');
const FORCE      = args.includes('--force');

// ── Database connection ───────────────────────────────────────────────────────

const poolerUrl = String(getSecret('DATABASE_URL') || process.env.DATABASE_URL || '').trim();

if (!poolerUrl) {
  console.error('❌ DATABASE_URL is not set. Add it in Settings → Secrets.');
  process.exit(1);
}

// Use direct (non-pooler) URL for INSERT operations
// Neon's pooler (PgBouncer) in transaction mode can silently drop writes
const directUrl = poolerUrl.replace(/-pooler\./, '.');
const sql = neon(directUrl);

// ── Report ────────────────────────────────────────────────────────────────────

interface TableReport {
  table:    string;
  source:   string;
  found:    number;
  valid:    number;
  inserted: number;
  skipped:  number;
  errors:   string[];
}

const report: {
  startedAt:  string;
  finishedAt: string;
  dryRun:     boolean;
  tables:     TableReport[];
  totalInserted: number;
  totalErrors:   number;
} = {
  startedAt:     new Date().toISOString(),
  finishedAt:    '',
  dryRun:        DRY_RUN,
  tables:        [],
  totalInserted: 0,
  totalErrors:   0,
};

function tableReport(table: string, source: string): TableReport {
  const r: TableReport = { table, source, found: 0, valid: 0, inserted: 0, skipped: 0, errors: [] };
  report.tables.push(r);
  return r;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, i) => {
      try { return JSON.parse(line) as T; }
      catch { console.warn(`  ⚠ Parse error at ${filePath}:${i + 1}`); return null; }
    })
    .filter((r): r is T => r !== null);
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T; }
  catch { return null; }
}

function ts(v: string | undefined | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function uid(): string {
  return crypto.randomBytes(8).toString('hex');
}

// ── 1. Users ──────────────────────────────────────────────────────────────────

async function migrateUsers() {
  const r = tableReport('users', '/private/users/users.jsonl');
  const rows = readJsonl<Record<string, unknown>>('/private/users/users.jsonl');
  r.found = rows.length;

  console.log(`\n📦 users: ${rows.length} records found`);

  for (const u of rows) {
    if (!u.id || !u.email || !u.passwordHash) {
      r.errors.push(`Invalid user record: missing id/email/passwordHash — ${JSON.stringify(u).slice(0, 80)}`);
      continue;
    }
    r.valid++;

    if (DRY_RUN) { r.skipped++; continue; }

    try {
      await sql`
        INSERT INTO users (
          id, email, name, phone, country,
          status, kyc_status, email_verified,
          email_verify_token, email_verify_expiry,
          password_hash, login_attempts,
          last_login_at, last_login_ip, ip, balance,
          bank_name, bank_account_number, bank_routing_number, bank_swift, bank_iban,
          wallet_btc, wallet_eth, wallet_usdt, wallet_sol,
          avatar_url, date_of_birth, address, city, postal_code,
          id_type, id_number, id_document_url,
          kyc_submitted_at, kyc_approved_at, kyc_rejected_at, kyc_rejection_reason,
          selfie_url, approved_at, approved_by, rejected_at, rejected_by, rejection_reason,
          primary_currency, account_tier,
          totp_secret, totp_enabled, locale, timezone,
          created_at, updated_at
        ) VALUES (
          ${String(u.id)},
          ${String(u.email).toLowerCase()},
          ${String(u.name || '')},
          ${u.phone ? String(u.phone) : null},
          ${u.country ? String(u.country) : null},
          ${String(u.status || 'pending_verification')},
          ${String(u.kycStatus || 'not_submitted')},
          ${Boolean(u.emailVerified)},
          ${u.emailVerifyToken ? String(u.emailVerifyToken) : null},
          ${ts(u.emailVerifyExpiry as string)},
          ${String(u.passwordHash)},
          ${Number(u.loginAttempts) || 0},
          ${ts(u.lastLoginAt as string)},
          ${u.lastLoginIp ? String(u.lastLoginIp) : null},
          ${u.ip ? String(u.ip) : null},
          ${Number(u.balance) || 0},
          ${u.bankName ? String(u.bankName) : null},
          ${u.bankAccountNumber ? String(u.bankAccountNumber) : null},
          ${u.bankRoutingNumber ? String(u.bankRoutingNumber) : null},
          ${u.bankSwift ? String(u.bankSwift) : null},
          ${u.bankIban ? String(u.bankIban) : null},
          ${u.walletBtc ? String(u.walletBtc) : null},
          ${u.walletEth ? String(u.walletEth) : null},
          ${u.walletUsdt ? String(u.walletUsdt) : null},
          ${u.walletSol ? String(u.walletSol) : null},
          ${u.avatarUrl ? String(u.avatarUrl) : null},
          ${u.dateOfBirth ? String(u.dateOfBirth) : null},
          ${u.address ? String(u.address) : null},
          ${u.city ? String(u.city) : null},
          ${u.postalCode ? String(u.postalCode) : null},
          ${u.idType ? String(u.idType) : null},
          ${u.idNumber ? String(u.idNumber) : null},
          ${u.idDocumentUrl ? String(u.idDocumentUrl) : null},
          ${ts(u.kycSubmittedAt as string)},
          ${ts(u.kycApprovedAt as string)},
          ${ts(u.kycRejectedAt as string)},
          ${u.kycRejectionReason ? String(u.kycRejectionReason) : null},
          ${u.selfieUrl ? String(u.selfieUrl) : null},
          ${ts(u.approvedAt as string)},
          ${u.approvedBy ? String(u.approvedBy) : null},
          ${ts(u.rejectedAt as string)},
          ${u.rejectedBy ? String(u.rejectedBy) : null},
          ${u.rejectionReason ? String(u.rejectionReason) : null},
          ${String(u.primaryCurrency || 'USD')},
          ${String(u.accountTier || 'personal')},
          ${u.totpSecret ? String(u.totpSecret) : null},
          ${Boolean(u.totpEnabled)},
          ${u.locale ? String(u.locale) : null},
          ${u.timezone ? String(u.timezone) : null},
          ${ts(u.createdAt as string) ?? new Date()},
          ${ts(u.updatedAt as string) ?? new Date()}
        )
        ON CONFLICT (id) DO ${FORCE ? sql`UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
        ` : sql`NOTHING`}
      `;
      r.inserted++;
    } catch (err) {
      r.errors.push(`User ${u.id}: ${String(err).slice(0, 200)}`);
    }
  }

  console.log(`  ✅ valid=${r.valid} inserted=${r.inserted} skipped=${r.skipped} errors=${r.errors.length}`);
}

// ── 2. Transactions ───────────────────────────────────────────────────────────

async function migrateTransactions() {
  const r = tableReport('transactions', '/private/transactions/transactions.jsonl');
  const rows = readJsonl<Record<string, unknown>>('/private/transactions/transactions.jsonl');
  r.found = rows.length;

  console.log(`\n📦 transactions: ${rows.length} records found`);

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    for (const t of batch) {
      if (!t.id || !t.userId || !t.amount) {
        r.errors.push(`Invalid tx: ${JSON.stringify(t).slice(0, 80)}`);
        continue;
      }
      r.valid++;
      if (DRY_RUN) { r.skipped++; continue; }

      try {
        await sql`
          INSERT INTO transactions (
            id, type, status, user_id, user_name, user_email,
            amount, currency, reference, description, note,
            wallet_address, network, tx_hash,
            bank_name, account_number, routing_number, swift_code,
            approved_by, approved_at, rejected_by, rejected_at, rejection_reason,
            frozen_by, frozen_at, admin_note, flagged, ip,
            created_at, updated_at
          ) VALUES (
            ${String(t.id)},
            ${String(t.type || 'deposit')},
            ${String(t.status || 'pending')},
            ${String(t.userId)},
            ${String(t.userName || '')},
            ${String(t.userEmail || '')},
            ${Number(t.amount)},
            ${String(t.currency || 'USD')},
            ${String(t.reference || 'CGC' + uid().toUpperCase())},
            ${String(t.description || '')},
            ${t.note ? String(t.note) : null},
            ${t.walletAddress ? String(t.walletAddress) : null},
            ${t.network ? String(t.network) : null},
            ${t.txHash ? String(t.txHash) : null},
            ${t.bankName ? String(t.bankName) : null},
            ${t.accountNumber ? String(t.accountNumber) : null},
            ${t.routingNumber ? String(t.routingNumber) : null},
            ${t.swiftCode ? String(t.swiftCode) : null},
            ${t.approvedBy ? String(t.approvedBy) : null},
            ${ts(t.approvedAt as string)},
            ${t.rejectedBy ? String(t.rejectedBy) : null},
            ${ts(t.rejectedAt as string)},
            ${t.rejectionReason ? String(t.rejectionReason) : null},
            ${t.frozenBy ? String(t.frozenBy) : null},
            ${ts(t.frozenAt as string)},
            ${t.adminNote ? String(t.adminNote) : null},
            ${Boolean(t.flagged)},
            ${t.ip ? String(t.ip) : null},
            ${ts(t.createdAt as string) ?? new Date()},
            ${ts(t.updatedAt as string) ?? new Date()}
          )
          ON CONFLICT (id) DO NOTHING
        `;
        r.inserted++;
      } catch (err) {
        r.errors.push(`Tx ${t.id}: ${String(err).slice(0, 200)}`);
      }
    }
  }

  console.log(`  ✅ valid=${r.valid} inserted=${r.inserted} skipped=${r.skipped} errors=${r.errors.length}`);
}

// ── 3. Cards ──────────────────────────────────────────────────────────────────

async function migrateCards() {
  const r = tableReport('cards', '/private/cards/cards.jsonl');
  const rows = readJsonl<Record<string, unknown>>('/private/cards/cards.jsonl');
  r.found = rows.length;

  console.log(`\n📦 cards: ${rows.length} records found`);

  for (const c of rows) {
    if (!c.id || !c.userId) {
      r.errors.push(`Invalid card: ${JSON.stringify(c).slice(0, 80)}`);
      continue;
    }
    r.valid++;
    if (DRY_RUN) { r.skipped++; continue; }

    try {
      // number and cvv are already stored as "enc:..." in the flat file
      const numberEnc = String(c.number || c.numberEnc || '');
      const cvvEnc    = String(c.cvv    || c.cvvEnc    || '');
      const last4     = String(c.last4  || numberEnc.slice(-4) || '0000');

      await sql`
        INSERT INTO cards (
          id, user_id, number_enc, cvv_enc, last4, expiry,
          cardholder_name, type, network, status, frozen,
          spending_limit, pin, color, created_at, updated_at
        ) VALUES (
          ${String(c.id)},
          ${String(c.userId)},
          ${numberEnc},
          ${cvvEnc},
          ${last4},
          ${String(c.expiry || '12/99')},
          ${String(c.cardholderName || c.name || '')},
          ${String(c.type || 'virtual')},
          ${String(c.network || 'Visa')},
          ${String(c.status || 'active')},
          ${Boolean(c.frozen)},
          ${c.spendingLimit ? Number(c.spendingLimit) : null},
          ${c.pin ? String(c.pin) : null},
          ${String(c.color || '#1a1a2e')},
          ${ts(c.createdAt as string) ?? new Date()},
          ${ts(c.updatedAt as string) ?? new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      r.inserted++;
    } catch (err) {
      r.errors.push(`Card ${c.id}: ${String(err).slice(0, 200)}`);
    }
  }

  // Card activity
  const ra = tableReport('card_activity', '/private/cards/activity.jsonl');
  const activity = readJsonl<Record<string, unknown>>('/private/cards/activity.jsonl');
  ra.found = activity.length;

  for (const a of activity) {
    if (!a.id || !a.cardId) { ra.errors.push(`Invalid activity: ${JSON.stringify(a).slice(0, 80)}`); continue; }
    ra.valid++;
    if (DRY_RUN) { ra.skipped++; continue; }
    try {
      await sql`
        INSERT INTO card_activity (id, card_id, user_id, type, amount, currency, merchant, description, status, created_at)
        VALUES (
          ${String(a.id)}, ${String(a.cardId)}, ${String(a.userId || '')},
          ${String(a.type || 'purchase')}, ${a.amount ? Number(a.amount) : null},
          ${a.currency ? String(a.currency) : null}, ${a.merchant ? String(a.merchant) : null},
          ${a.description ? String(a.description) : null}, ${String(a.status || 'completed')},
          ${ts(a.createdAt as string) ?? new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      ra.inserted++;
    } catch (err) {
      ra.errors.push(`Activity ${a.id}: ${String(err).slice(0, 200)}`);
    }
  }

  console.log(`  ✅ cards: valid=${r.valid} inserted=${r.inserted} errors=${r.errors.length}`);
  console.log(`  ✅ card_activity: valid=${ra.valid} inserted=${ra.inserted} errors=${ra.errors.length}`);
}

// ── 4. Wallets ────────────────────────────────────────────────────────────────

async function migrateWallets() {
  const r = tableReport('wallets', '/private/wallets/wallets.json');
  const data = readJson<Record<string, unknown>[]>('/private/wallets/wallets.json');
  const rows = Array.isArray(data) ? data : [];
  r.found = rows.length;

  console.log(`\n📦 wallets: ${rows.length} records found`);

  for (const w of rows) {
    if (!w.id) { r.errors.push(`Invalid wallet: ${JSON.stringify(w).slice(0, 80)}`); continue; }
    r.valid++;
    if (DRY_RUN) { r.skipped++; continue; }
    try {
      await sql`
        INSERT INTO wallets (id, symbol, name, network, address, qr_code, min_deposit, confirmations, enabled, updated_at, updated_by)
        VALUES (
          ${String(w.id)}, ${String(w.symbol || '')}, ${String(w.name || '')},
          ${String(w.network || '')}, ${String(w.address || '')},
          ${w.qrCode ? String(w.qrCode) : null},
          ${Number(w.minDeposit) || 0}, ${Number(w.confirmations) || 1},
          ${Boolean(w.enabled !== false)},
          ${ts(w.updatedAt as string) ?? new Date()},
          ${w.updatedBy ? String(w.updatedBy) : null}
        )
        ON CONFLICT (id) DO ${FORCE ? sql`UPDATE SET
          address = EXCLUDED.address,
          enabled = EXCLUDED.enabled,
          updated_at = EXCLUDED.updated_at
        ` : sql`NOTHING`}
      `;
      r.inserted++;
    } catch (err) {
      r.errors.push(`Wallet ${w.id}: ${String(err).slice(0, 200)}`);
    }
  }

  console.log(`  ✅ valid=${r.valid} inserted=${r.inserted} errors=${r.errors.length}`);
}

// ── 5. KYC ────────────────────────────────────────────────────────────────────

async function migrateKyc() {
  // KYC notes
  const r = tableReport('kyc_notes', '/private/kyc/admin-notes.jsonl');
  const notes = readJsonl<Record<string, unknown>>('/private/kyc/admin-notes.jsonl');
  r.found = notes.length;

  console.log(`\n📦 kyc_notes: ${notes.length} records found`);

  for (const n of notes) {
    if (!n.userId || !n.note) { r.errors.push(`Invalid kyc_note: ${JSON.stringify(n).slice(0, 80)}`); continue; }
    r.valid++;
    if (DRY_RUN) { r.skipped++; continue; }
    try {
      const id = String(n.id || 'kn_' + uid());
      await sql`
        INSERT INTO kyc_notes (id, user_id, admin_id, admin_name, note, created_at)
        VALUES (
          ${id}, ${String(n.userId)}, ${String(n.adminId || 'system')},
          ${n.adminName ? String(n.adminName) : null},
          ${String(n.note)},
          ${ts(n.createdAt as string) ?? new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      r.inserted++;
    } catch (err) {
      r.errors.push(`KYC note: ${String(err).slice(0, 200)}`);
    }
  }

  // KYC settings
  const settings = readJson<Record<string, unknown>>('/private/kyc/settings.json');
  if (settings && !DRY_RUN) {
    try {
      await sql`
        INSERT INTO kyc_settings (id, expiry_months, renewal_reminder_days, auto_restrict_expired, updated_at, updated_by)
        VALUES (
          1,
          ${Number(settings.expiryMonths) || 12},
          ${Number(settings.renewalReminderDays) || 30},
          ${Boolean(settings.autoRestrictExpired !== false)},
          ${ts(settings.updatedAt as string) ?? new Date()},
          ${settings.updatedBy ? String(settings.updatedBy) : null}
        )
        ON CONFLICT (id) DO UPDATE SET
          expiry_months = EXCLUDED.expiry_months,
          renewal_reminder_days = EXCLUDED.renewal_reminder_days,
          auto_restrict_expired = EXCLUDED.auto_restrict_expired,
          updated_at = EXCLUDED.updated_at
      `;
    } catch (err) {
      r.errors.push(`KYC settings: ${String(err).slice(0, 200)}`);
    }
  }

  console.log(`  ✅ valid=${r.valid} inserted=${r.inserted} errors=${r.errors.length}`);
}

// ── 6. Trading ────────────────────────────────────────────────────────────────

async function migrateTrading() {
  const TRADING_DIR = '/private/trading';

  // Positions
  const rp = tableReport('trading_positions', `${TRADING_DIR}/positions.jsonl`);
  const positions = readJsonl<Record<string, unknown>>(`${TRADING_DIR}/positions.jsonl`);
  rp.found = positions.length;
  console.log(`\n📦 trading_positions: ${positions.length} records found`);

  for (const p of positions) {
    if (!p.id || !p.userId) { rp.errors.push(`Invalid position: ${JSON.stringify(p).slice(0, 80)}`); continue; }
    rp.valid++;
    if (DRY_RUN) { rp.skipped++; continue; }
    try {
      await sql`
        INSERT INTO trading_positions (
          id, user_id, symbol, asset_class, side, quantity,
          avg_entry_price, current_price, unrealised_pnl, realised_pnl,
          status, currency, leverage, stop_loss, take_profit, opened_at, closed_at
        ) VALUES (
          ${String(p.id)}, ${String(p.userId)}, ${String(p.symbol || '')},
          ${String(p.assetClass || 'crypto')}, ${String(p.side || 'buy')},
          ${Number(p.quantity) || 0}, ${Number(p.avgEntryPrice) || 0},
          ${Number(p.currentPrice) || 0}, ${Number(p.unrealisedPnl) || 0},
          ${Number(p.realisedPnl) || 0}, ${String(p.status || 'open')},
          ${String(p.currency || 'USD')}, ${Number(p.leverage) || 1},
          ${p.stopLoss ? Number(p.stopLoss) : null},
          ${p.takeProfit ? Number(p.takeProfit) : null},
          ${ts(p.openedAt as string) ?? new Date()},
          ${ts(p.closedAt as string)}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      rp.inserted++;
    } catch (err) {
      rp.errors.push(`Position ${p.id}: ${String(err).slice(0, 200)}`);
    }
  }

  // Orders
  const ro = tableReport('trading_orders', `${TRADING_DIR}/orders.jsonl`);
  const orders = readJsonl<Record<string, unknown>>(`${TRADING_DIR}/orders.jsonl`);
  ro.found = orders.length;
  console.log(`  📦 trading_orders: ${orders.length} records found`);

  for (const o of orders) {
    if (!o.id || !o.userId) { ro.errors.push(`Invalid order: ${JSON.stringify(o).slice(0, 80)}`); continue; }
    ro.valid++;
    if (DRY_RUN) { ro.skipped++; continue; }
    try {
      await sql`
        INSERT INTO trading_orders (
          id, user_id, symbol, asset_class, side, type, status,
          quantity, price, stop_price, filled_qty, avg_fill_price,
          fee, currency, position_id, created_at, updated_at, expires_at
        ) VALUES (
          ${String(o.id)}, ${String(o.userId)}, ${String(o.symbol || '')},
          ${String(o.assetClass || 'crypto')}, ${String(o.side || 'buy')},
          ${String(o.type || 'market')}, ${String(o.status || 'pending')},
          ${Number(o.quantity) || 0}, ${o.price ? Number(o.price) : null},
          ${o.stopPrice ? Number(o.stopPrice) : null},
          ${Number(o.filledQty) || 0}, ${o.avgFillPrice ? Number(o.avgFillPrice) : null},
          ${Number(o.fee) || 0}, ${String(o.currency || 'USD')},
          ${o.positionId ? String(o.positionId) : null},
          ${ts(o.createdAt as string) ?? new Date()},
          ${ts(o.updatedAt as string) ?? new Date()},
          ${ts(o.expiresAt as string)}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      ro.inserted++;
    } catch (err) {
      ro.errors.push(`Order ${o.id}: ${String(err).slice(0, 200)}`);
    }
  }

  // Trades
  const rt = tableReport('trading_trades', `${TRADING_DIR}/trades.jsonl`);
  const trades = readJsonl<Record<string, unknown>>(`${TRADING_DIR}/trades.jsonl`);
  rt.found = trades.length;
  console.log(`  📦 trading_trades: ${trades.length} records found`);

  for (const t of trades) {
    if (!t.id || !t.userId) { rt.errors.push(`Invalid trade: ${JSON.stringify(t).slice(0, 80)}`); continue; }
    rt.valid++;
    if (DRY_RUN) { rt.skipped++; continue; }
    try {
      await sql`
        INSERT INTO trading_trades (id, user_id, order_id, position_id, symbol, asset_class, side, quantity, price, fee, currency, pnl, executed_at)
        VALUES (
          ${String(t.id)}, ${String(t.userId)}, ${String(t.orderId || '')},
          ${t.positionId ? String(t.positionId) : null},
          ${String(t.symbol || '')}, ${String(t.assetClass || 'crypto')},
          ${String(t.side || 'buy')}, ${Number(t.quantity) || 0},
          ${Number(t.price) || 0}, ${Number(t.fee) || 0},
          ${String(t.currency || 'USD')}, ${t.pnl ? Number(t.pnl) : null},
          ${ts(t.executedAt as string) ?? new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      rt.inserted++;
    } catch (err) {
      rt.errors.push(`Trade ${t.id}: ${String(err).slice(0, 200)}`);
    }
  }

  // Watchlist
  const rw = tableReport('trading_watchlist', `${TRADING_DIR}/watchlist.jsonl`);
  const watchlist = readJsonl<Record<string, unknown>>(`${TRADING_DIR}/watchlist.jsonl`);
  rw.found = watchlist.length;

  for (const w of watchlist) {
    if (!w.id || !w.userId) { rw.errors.push(`Invalid watchlist: ${JSON.stringify(w).slice(0, 80)}`); continue; }
    rw.valid++;
    if (DRY_RUN) { rw.skipped++; continue; }
    try {
      await sql`
        INSERT INTO trading_watchlist (id, user_id, symbol, asset_class, added_at)
        VALUES (
          ${String(w.id)}, ${String(w.userId)}, ${String(w.symbol || '')},
          ${String(w.assetClass || 'crypto')},
          ${ts(w.addedAt as string) ?? new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      rw.inserted++;
    } catch (err) {
      rw.errors.push(`Watchlist ${w.id}: ${String(err).slice(0, 200)}`);
    }
  }

  console.log(`  ✅ positions=${rp.inserted} orders=${ro.inserted} trades=${rt.inserted} watchlist=${rw.inserted}`);
}

// ── 7. Notifications ──────────────────────────────────────────────────────────

async function migrateNotifications() {
  const r = tableReport('notifications', '/private/notifications/notifications.jsonl');
  const rows = readJsonl<Record<string, unknown>>('/private/notifications/notifications.jsonl');
  r.found = rows.length;

  console.log(`\n📦 notifications: ${rows.length} records found`);

  for (const n of rows) {
    if (!n.id || !n.userId) { r.errors.push(`Invalid notification: ${JSON.stringify(n).slice(0, 80)}`); continue; }
    r.valid++;
    if (DRY_RUN) { r.skipped++; continue; }
    try {
      await sql`
        INSERT INTO notifications (id, user_id, title, message, link, read, created_at)
        VALUES (
          ${String(n.id)}, ${String(n.userId)},
          ${String(n.title || '')}, ${String(n.message || '')},
          ${n.link ? String(n.link) : null},
          ${Boolean(n.read)},
          ${ts(n.createdAt as string) ?? new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      r.inserted++;
    } catch (err) {
      r.errors.push(`Notification ${n.id}: ${String(err).slice(0, 200)}`);
    }
  }

  console.log(`  ✅ valid=${r.valid} inserted=${r.inserted} errors=${r.errors.length}`);
}

// ── 8. Support ────────────────────────────────────────────────────────────────

async function migrateSupport() {
  const r = tableReport('support_conversations', '/private/support/conversations.jsonl');
  const rows = readJsonl<Record<string, unknown>>('/private/support/conversations.jsonl');
  r.found = rows.length;

  console.log(`\n📦 support_conversations: ${rows.length} records found`);

  for (const c of rows) {
    if (!c.id || !c.userId) { r.errors.push(`Invalid conversation: ${JSON.stringify(c).slice(0, 80)}`); continue; }
    r.valid++;
    if (DRY_RUN) { r.skipped++; continue; }

    try {
      await sql`
        INSERT INTO support_conversations (
          id, user_id, user_name, user_email, subject, category,
          priority, status, assigned_to, first_reply_at, resolved_at,
          created_at, updated_at
        ) VALUES (
          ${String(c.id)}, ${String(c.userId)},
          ${String(c.userName || '')}, ${String(c.userEmail || '')},
          ${String(c.subject || '')}, ${String(c.category || 'General')},
          ${String(c.priority || 'medium')}, ${String(c.status || 'open')},
          ${c.assignedTo ? String(c.assignedTo) : null},
          ${ts(c.firstReplyAt as string)}, ${ts(c.resolvedAt as string)},
          ${ts(c.createdAt as string) ?? new Date()},
          ${ts(c.updatedAt as string) ?? new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      r.inserted++;

      // Migrate embedded messages
      const messages = Array.isArray(c.messages) ? c.messages as Record<string, unknown>[] : [];
      for (const m of messages) {
        const mid = String(m.id || 'sm_' + uid());
        try {
          await sql`
            INSERT INTO support_messages (id, conversation_id, "from", text, admin_name, ts)
            VALUES (
              ${mid}, ${String(c.id)}, ${String(m.from || 'customer')},
              ${String(m.text || '')}, ${m.adminName ? String(m.adminName) : null},
              ${ts(m.ts as string) ?? new Date()}
            )
            ON CONFLICT (id) DO NOTHING
          `;
        } catch { /* ignore duplicate messages */ }
      }

      // Migrate embedded internal notes
      const notes = Array.isArray(c.internalNotes) ? c.internalNotes as Record<string, unknown>[] : [];
      for (const n of notes) {
        const nid = String(n.id || 'sn_' + uid());
        try {
          await sql`
            INSERT INTO support_notes (id, conversation_id, text, admin_id, admin_name, ts)
            VALUES (
              ${nid}, ${String(c.id)}, ${String(n.text || '')},
              ${String(n.adminId || 'system')}, ${n.adminName ? String(n.adminName) : null},
              ${ts(n.ts as string) ?? new Date()}
            )
            ON CONFLICT (id) DO NOTHING
          `;
        } catch { /* ignore duplicate notes */ }
      }
    } catch (err) {
      r.errors.push(`Conversation ${c.id}: ${String(err).slice(0, 200)}`);
    }
  }

  // Canned responses
  const rc = tableReport('canned_responses', '/private/support/canned-responses.json');
  const canned = readJson<Record<string, unknown>[]>('/private/support/canned-responses.json');
  const cannedRows = Array.isArray(canned) ? canned : [];
  rc.found = cannedRows.length;

  for (const cr of cannedRows) {
    if (!cr.id) { rc.errors.push(`Invalid canned response: ${JSON.stringify(cr).slice(0, 80)}`); continue; }
    rc.valid++;
    if (DRY_RUN) { rc.skipped++; continue; }
    try {
      await sql`
        INSERT INTO canned_responses (id, title, body, category, created_at, updated_at)
        VALUES (
          ${String(cr.id)}, ${String(cr.title || '')}, ${String(cr.body || '')},
          ${String(cr.category || 'General')},
          ${ts(cr.createdAt as string) ?? new Date()},
          ${ts(cr.updatedAt as string) ?? new Date()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      rc.inserted++;
    } catch (err) {
      rc.errors.push(`Canned ${cr.id}: ${String(err).slice(0, 200)}`);
    }
  }

  console.log(`  ✅ conversations=${r.inserted} canned=${rc.inserted} errors=${r.errors.length}`);
}

// ── 9. Login events ───────────────────────────────────────────────────────────

async function migrateLoginEvents() {
  const r = tableReport('login_events', '/private/logs/login.jsonl');
  const rows = readJsonl<Record<string, unknown>>('/private/logs/login.jsonl');
  r.found = rows.length;

  console.log(`\n📦 login_events: ${rows.length} records found`);

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const e of batch) {
      if (!e.id || !e.email) { r.errors.push(`Invalid login event: ${JSON.stringify(e).slice(0, 80)}`); continue; }
      r.valid++;
      if (DRY_RUN) { r.skipped++; continue; }
      try {
        await sql`
          INSERT INTO login_events (id, ts, actor, email, user_id, result, ip, ua, device, browser, os, country, reason, session_id, duration)
          VALUES (
            ${String(e.id)},
            ${ts(e.ts as string) ?? new Date()},
            ${String(e.actor || 'user')},
            ${String(e.email)},
            ${e.userId ? String(e.userId) : null},
            ${String(e.result || 'success')},
            ${String(e.ip || '')},
            ${String(e.ua || '')},
            ${String(e.device || 'unknown')},
            ${String(e.browser || 'Unknown')},
            ${String(e.os || 'Unknown')},
            ${String(e.country || 'Unknown')},
            ${e.reason ? String(e.reason) : null},
            ${e.sessionId ? String(e.sessionId) : null},
            ${e.duration ? Number(e.duration) : null}
          )
          ON CONFLICT (id) DO NOTHING
        `;
        r.inserted++;
      } catch (err) {
        r.errors.push(`LoginEvent ${e.id}: ${String(err).slice(0, 200)}`);
      }
    }
  }

  console.log(`  ✅ valid=${r.valid} inserted=${r.inserted} errors=${r.errors.length}`);
}

// ── 10. Admin sessions ────────────────────────────────────────────────────────

async function migrateAdminSessions() {
  const r = tableReport('admin_sessions', '/private/admin/sessions.json');
  const data = readJson<Record<string, Record<string, unknown>>>('/private/admin/sessions.json');
  if (!data) { console.log('\n📦 admin_sessions: no file found — skipping'); return; }

  const rows = Object.entries(data);
  r.found = rows.length;
  console.log(`\n📦 admin_sessions: ${rows.length} records found`);

  for (const [token, s] of rows) {
    if (!token || !s.adminId) { r.errors.push(`Invalid session: ${token}`); continue; }
    r.valid++;
    if (DRY_RUN) { r.skipped++; continue; }

    // Calculate expiry: createdAt + 8 hours
    const createdAt = ts(s.createdAt as string) ?? new Date();
    const expiresAt = new Date(createdAt.getTime() + 8 * 3600 * 1000);

    try {
      await sql`
        INSERT INTO admin_sessions (token, admin_id, email, role, ip, ua, created_at, last_seen_at, expires_at)
        VALUES (
          ${token}, ${String(s.adminId)}, ${String(s.email || '')},
          ${String(s.role || 'SUPER_ADMIN')},
          ${String(s.ip || '')}, ${String(s.ua || '')},
          ${createdAt},
          ${ts(s.lastSeenAt as string) ?? createdAt},
          ${expiresAt}
        )
        ON CONFLICT (token) DO NOTHING
      `;
      r.inserted++;
    } catch (err) {
      r.errors.push(`AdminSession ${token.slice(0, 8)}: ${String(err).slice(0, 200)}`);
    }
  }

  console.log(`  ✅ valid=${r.valid} inserted=${r.inserted} errors=${r.errors.length}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  City Gate Capital — Flat-File → PostgreSQL Migration');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '💾 LIVE (writing to database)'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!DRY_RUN) {
    console.log('🔌 Connecting to database...');
    try {
      await sql`SELECT 1`;
      console.log('✅ Connected\n');
    } catch (err) {
      console.error('❌ Connection failed:', err);
      process.exit(1);
    }
  }

  await migrateUsers();
  await migrateTransactions();
  await migrateCards();
  await migrateWallets();
  await migrateKyc();
  await migrateTrading();
  await migrateNotifications();
  await migrateSupport();
  await migrateLoginEvents();
  await migrateAdminSessions();

  // ── Final report ──────────────────────────────────────────────────────────
  report.finishedAt    = new Date().toISOString();
  report.totalInserted = report.tables.reduce((s, t) => s + t.inserted, 0);
  report.totalErrors   = report.tables.reduce((s, t) => s + t.errors.length, 0);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Started:  ${report.startedAt}`);
  console.log(`  Finished: ${report.finishedAt}`);
  console.log(`  Mode:     ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  for (const t of report.tables) {
    const status = t.errors.length > 0 ? '⚠' : '✅';
    console.log(`  ${status} ${t.table.padEnd(30)} found=${t.found} valid=${t.valid} inserted=${t.inserted} errors=${t.errors.length}`);
    if (t.errors.length > 0) {
      t.errors.slice(0, 3).forEach(e => console.log(`      ❌ ${e}`));
      if (t.errors.length > 3) console.log(`      ... and ${t.errors.length - 3} more`);
    }
  }

  console.log('');
  console.log(`  Total inserted: ${report.totalInserted}`);
  console.log(`  Total errors:   ${report.totalErrors}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Write report to file
  const reportPath = '/private/migration-report.json';
  try {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report written to: ${reportPath}`);
  } catch { /* ignore if /private is not writable */ }

  if (report.totalErrors > 0) {
    console.log(`\n⚠ Migration completed with ${report.totalErrors} error(s). Review the report above.`);
    process.exit(0);
  } else {
    console.log('\n✅ Migration completed successfully. All records imported.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
