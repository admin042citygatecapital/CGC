/**
 * Drizzle ORM schema — Postgres (Neon) — mirrors the flat-file store shapes
 * exactly so DB-mode and flat-file-mode stay interchangeable behind the
 * `isDatabaseConfigured()` guard. Column names match what src/server/lib/*Store.ts
 * expects; enum-like columns are plain `text` (not Postgres enums) since the
 * store code already casts to the app-level union types on read.
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  unique,
} from 'drizzle-orm/pg-core';

const money = (name: string) => numeric(name, { precision: 24, scale: 8, mode: 'number' });

// ── users ─────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  country: text('country'),
  status: text('status').notNull().default('pending_verification'),
  kycStatus: text('kyc_status').notNull().default('not_submitted'),
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerifyToken: text('email_verify_token'),
  emailVerifyExpiry: timestamp('email_verify_expiry'),
  passwordHash: text('password_hash').notNull(),
  loginAttempts: integer('login_attempts').notNull().default(0),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  ip: text('ip'),
  balance: money('balance').notNull().default(0),
  bankName: text('bank_name'),
  bankAccountNumber: text('bank_account_number'),
  bankRoutingNumber: text('bank_routing_number'),
  bankSwift: text('bank_swift'),
  bankIban: text('bank_iban'),
  walletBtc: text('wallet_btc'),
  walletEth: text('wallet_eth'),
  walletUsdt: text('wallet_usdt'),
  walletSol: text('wallet_sol'),
  avatarUrl: text('avatar_url'),
  dateOfBirth: text('date_of_birth'),
  address: text('address'),
  city: text('city'),
  postalCode: text('postal_code'),
  idType: text('id_type'),
  idNumber: text('id_number'),
  idDocumentUrl: text('id_document_url'),
  kycSubmittedAt: timestamp('kyc_submitted_at'),
  kycApprovedAt: timestamp('kyc_approved_at'),
  kycRejectedAt: timestamp('kyc_rejected_at'),
  kycRejectionReason: text('kyc_rejection_reason'),
  selfieUrl: text('selfie_url'),
  approvedAt: timestamp('approved_at'),
  approvedBy: text('approved_by'),
  rejectedAt: timestamp('rejected_at'),
  rejectedBy: text('rejected_by'),
  rejectionReason: text('rejection_reason'),
  primaryCurrency: text('primary_currency').notNull().default('USD'),
  accountTier: text('account_tier').notNull().default('personal'),
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  locale: text('locale'),
  timezone: text('timezone'),
  notificationPrefs: jsonb('notification_prefs').$type<unknown>(),
  beneficiaries: jsonb('beneficiaries').$type<unknown>(),
  trustedDevices: jsonb('trusted_devices').$type<unknown>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ── adminSessions ────────────────────────────────────────────────────────
export const adminSessions = pgTable('admin_sessions', {
  token: text('token').primaryKey(),
  adminId: text('admin_id').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull(),
  ip: text('ip').notNull(),
  ua: text('ua').notNull(),
  createdAt: timestamp('created_at').notNull(),
  lastSeenAt: timestamp('last_seen_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

export type AdminSession = typeof adminSessions.$inferSelect;

// ── customerSessions ─────────────────────────────────────────────────────
export const customerSessions = pgTable('customer_sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  ip: text('ip'),
  ua: text('ua'),
  createdAt: timestamp('created_at').notNull(),
  lastSeenAt: timestamp('last_seen_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

// ── accessLog ─────────────────────────────────────────────────────────────
export const accessLog = pgTable('access_log', {
  id: text('id').primaryKey(),
  ts: timestamp('ts').notNull().defaultNow(),
  method: text('method').notNull(),
  url: text('url').notNull(),
  status: integer('status').notNull(),
  duration: integer('duration').notNull(),
  ip: text('ip').notNull(),
  ua: text('ua').notNull(),
  referer: text('referer').notNull(),
  bytes: integer('bytes').notNull(),
  userId: text('user_id'),
  threat: text('threat').notNull(),
  threatNote: text('threat_note').notNull(),
});

// ── auditLog ──────────────────────────────────────────────────────────────
export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  adminId: text('admin_id').notNull(),
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(),
  target: text('target'),
  targetId: text('target_id'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  ip: text('ip'),
  ts: timestamp('ts').notNull(),
});

// ── config (generic key/value store) ────────────────────────────────────
export const config = pgTable('config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull().$type<unknown>(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: text('updated_by'),
});

// ── transactions ──────────────────────────────────────────────────────────
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending'),
  userId: text('user_id').notNull().references(() => users.id),
  userName: text('user_name').notNull(),
  userEmail: text('user_email').notNull(),
  amount: money('amount').notNull(),
  currency: text('currency').notNull(),
  reference: text('reference').notNull(),
  description: text('description').notNull(),
  note: text('note'),
  walletAddress: text('wallet_address'),
  network: text('network'),
  txHash: text('tx_hash'),
  bankName: text('bank_name'),
  accountNumber: text('account_number'),
  routingNumber: text('routing_number'),
  swiftCode: text('swift_code'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  rejectedBy: text('rejected_by'),
  rejectedAt: timestamp('rejected_at'),
  rejectionReason: text('rejection_reason'),
  frozenBy: text('frozen_by'),
  frozenAt: timestamp('frozen_at'),
  adminNote: text('admin_note'),
  flagged: boolean('flagged').notNull().default(false),
  ip: text('ip'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export type Transaction = typeof transactions.$inferSelect;

// ── wallets ───────────────────────────────────────────────────────────────
export const wallets = pgTable('wallets', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  network: text('network').notNull(),
  address: text('address').notNull().default(''),
  qrCode: text('qr_code'),
  minDeposit: money('min_deposit').notNull(),
  confirmations: integer('confirmations').notNull(),
  enabled: boolean('enabled').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  updatedBy: text('updated_by'),
});

export type Wallet = typeof wallets.$inferSelect;

// ── cards / cardActivity ─────────────────────────────────────────────────
export const cards = pgTable('cards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  numberEnc: text('number_enc').notNull(),
  cvvEnc: text('cvv_enc').notNull(),
  last4: text('last4').notNull(),
  expiry: text('expiry').notNull(),
  cardholderName: text('cardholder_name').notNull(),
  type: text('type').notNull(),
  network: text('network').notNull(),
  status: text('status').notNull(),
  frozen: boolean('frozen').notNull(),
  spendingLimit: money('spending_limit'),
  pin: text('pin'),
  color: text('color'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export type Card = typeof cards.$inferSelect;

export const cardActivity = pgTable('card_activity', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  amount: money('amount'),
  currency: text('currency'),
  merchant: text('merchant'),
  description: text('description'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export type CardActivity = typeof cardActivity.$inferSelect;

// ── notifications ────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  link: text('link'),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ── emailQueue ────────────────────────────────────────────────────────────
export const emailQueue = pgTable('email_queue', {
  id: text('id').primaryKey(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  status: text('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
});

// ── loginEvents ───────────────────────────────────────────────────────────
export const loginEvents = pgTable('login_events', {
  id: text('id').primaryKey(),
  ts: timestamp('ts').notNull(),
  actor: text('actor').notNull(),
  email: text('email').notNull(),
  userId: text('user_id'),
  result: text('result').notNull(),
  ip: text('ip').notNull(),
  ua: text('ua').notNull(),
  device: text('device').notNull(),
  browser: text('browser').notNull(),
  os: text('os').notNull(),
  country: text('country').notNull(),
  reason: text('reason'),
  sessionId: text('session_id'),
  duration: integer('duration'),
});

export type LoginEvent = typeof loginEvents.$inferSelect;

// ── subscribers ───────────────────────────────────────────────────────────
export const subscribers = pgTable('subscribers', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  status: text('status').notNull().default('active'),
  source: text('source'),
  tags: jsonb('tags').$type<string[]>(),
  subscribedAt: timestamp('subscribed_at').notNull(),
  unsubscribedAt: timestamp('unsubscribed_at'),
  sequenceStep: integer('sequence_step').notNull().default(0),
  lastEmailAt: timestamp('last_email_at'),
});

export type Subscriber = typeof subscribers.$inferSelect;

// ── kycNotes / kycSettings ───────────────────────────────────────────────
export const kycNotes = pgTable('kyc_notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  adminId: text('admin_id').notNull(),
  adminName: text('admin_name'),
  note: text('note').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export const kycSettings = pgTable('kyc_settings', {
  id: integer('id').primaryKey(),
  expiryMonths: integer('expiry_months').notNull(),
  renewalReminderDays: integer('renewal_reminder_days').notNull(),
  autoRestrictExpired: boolean('auto_restrict_expired').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  updatedBy: text('updated_by'),
});

// ── trading ───────────────────────────────────────────────────────────────
export const tradingPositions = pgTable('trading_positions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  symbol: text('symbol').notNull(),
  assetClass: text('asset_class').notNull(),
  side: text('side').notNull(),
  quantity: money('quantity').notNull(),
  avgEntryPrice: money('avg_entry_price').notNull(),
  currentPrice: money('current_price').notNull(),
  unrealisedPnl: money('unrealised_pnl').notNull(),
  realisedPnl: money('realised_pnl').notNull(),
  status: text('status').notNull().default('open'),
  openedAt: timestamp('opened_at').notNull(),
  closedAt: timestamp('closed_at'),
  currency: text('currency').notNull(),
  leverage: money('leverage').notNull(),
  stopLoss: money('stop_loss'),
  takeProfit: money('take_profit'),
});

export type TradingPosition = typeof tradingPositions.$inferSelect;

export const tradingOrders = pgTable('trading_orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  symbol: text('symbol').notNull(),
  assetClass: text('asset_class').notNull(),
  side: text('side').notNull(),
  type: text('type').notNull(),
  quantity: money('quantity').notNull(),
  filledQty: money('filled_qty').notNull().default(0),
  price: money('price'),
  stopPrice: money('stop_price'),
  status: text('status').notNull().default('pending'),
  currency: text('currency').notNull(),
  fee: money('fee').notNull().default(0),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  expiresAt: timestamp('expires_at'),
});

export type TradingOrder = typeof tradingOrders.$inferSelect;

export const tradingTrades = pgTable('trading_trades', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  orderId: text('order_id').notNull().references(() => tradingOrders.id),
  positionId: text('position_id').references(() => tradingPositions.id),
  symbol: text('symbol').notNull(),
  assetClass: text('asset_class').notNull(),
  side: text('side').notNull(),
  quantity: money('quantity').notNull(),
  price: money('price').notNull(),
  fee: money('fee').notNull(),
  currency: text('currency').notNull(),
  pnl: money('pnl'),
  executedAt: timestamp('executed_at').notNull(),
});

export type TradingTrade = typeof tradingTrades.$inferSelect;

export const tradingWatchlist = pgTable('trading_watchlist', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  symbol: text('symbol').notNull(),
  assetClass: text('asset_class').notNull(),
  addedAt: timestamp('added_at').notNull(),
}, (t) => [
  unique('trading_watchlist_user_symbol_unique').on(t.userId, t.symbol),
]);

export type TradingWatchlistItem = typeof tradingWatchlist.$inferSelect;
